<?php

namespace Mapbender\CoreBundle\Component\Presenter\Application;

use Mapbender\CoreBundle\Component\Cache\ApplicationDataService;
use Mapbender\CoreBundle\Component\ElementFactory;
use Mapbender\CoreBundle\Component\Exception\ElementErrorException;
use Mapbender\CoreBundle\Entity;
use Mapbender\CoreBundle\Component\ElementBase\BoundConfigMutator;
use Mapbender\CoreBundle\Component\Presenter\SourceService;
use Mapbender\CoreBundle\Component\Source\TypeDirectoryService;
use Mapbender\CoreBundle\Component\Source\UrlProcessor;
use Mapbender\CoreBundle\Entity\Application;
use Mapbender\CoreBundle\Entity\Layerset;
use Mapbender\CoreBundle\Entity\SourceInstance;
use Mapbender\CoreBundle\Entity\SourceInstanceAssignment;
use Psr\Log\LoggerInterface;
use Symfony\Component\Asset\PackageInterface;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Mapbender\CoreBundle\Component\Presenter\ApplicationService;

/**
 * Service that generates the frontend-facing configuration for a Mapbender application.
 *
 *
 * Instance registerd in container as mapbender.presenter.application.config.service, see services.xml
 */
class ConfigService
{
    /** @var ApplicationService */
    protected $basePresenter;
    /** @var ApplicationDataService */
    protected $cacheService;
    /** @var TypeDirectoryService */
    protected $sourceTypeDirectory;
    /** @var UrlProcessor */
    protected $urlProcessor;
    /** @var ElementFactory */
    protected $elementFactory;

    /** @var UrlGeneratorInterface */
    protected $router;
    /** @var LoggerInterface */
    protected $logger;
    /** @var string */
    protected $environment;
    /** @var string */
    protected $assetBaseUrl;


    public function __construct(ApplicationService $basePresenter,
                                ApplicationDataService $cacheService,
                                TypeDirectoryService $sourceTypeDirectory,
                                UrlProcessor $urlProcessor,
                                ElementFactory $elementFactory,
                                UrlGeneratorInterface $router,
                                LoggerInterface $logger,
                                PackageInterface $baseUrlPackage,
                                $environment)
    {
        $this->basePresenter = $basePresenter;
        $this->cacheService = $cacheService;
        $this->sourceTypeDirectory = $sourceTypeDirectory;
        $this->urlProcessor = $urlProcessor;
        $this->elementFactory = $elementFactory;
        $this->router = $router;
        $this->logger = $logger;
        $this->assetBaseUrl = $baseUrlPackage->getUrl(null);
        $this->environment = $environment;
    }

    /**
     * @param Application $entity
     * @return mixed[]
     */
    public function getConfiguration(Application $entity)
    {
        $activeElements = $this->basePresenter->prepareElements($entity);
        $configuration = array(
            'application' => $this->getBaseConfiguration($entity),
            'elements'    => $this->getElementConfiguration($activeElements),
        );
        $configuration['layersets'] = $this->getLayerSetConfigs($entity);

        // Let (active, visible) Elements update the Application config
        // This is useful for BaseSourceSwitcher, SuggestMap, potentially many more, that influence the initially
        // visible state of the frontend.
        $configBeforeElement = $configAfterElements = $configuration;
        foreach ($activeElements as $element) {
            if (\is_a($element->getClass(), BoundConfigMutator::class, true)) {
                /** @var BoundConfigMutator $component */
                $component = $this->elementFactory->componentFromEntity($element, true);
                $configAfterElements = $component->updateAppConfig($configBeforeElement);
                $configBeforeElement = $configAfterElements;
            }
        }
        return $configAfterElements;
    }

    public function getBaseConfiguration(Application $entity)
    {
        return array(
            'title'         => $entity->getTitle(),
            'urls'          => $this->getUrls($entity),
            'publicOptions' => $entity->getPublicOptions(),
            'slug'          => $entity->getSlug(),
            'debug' => ($this->environment !== 'prod'),
            'mapEngineCode' => $entity->getMapEngineCode(),
            'persistentView' => $entity->getPersistentView(),
        );
    }

    /**
     * Get runtime URLs
     *
     * @param Application $entity
     * @return array
     */
    public function getUrls(Application $entity)
    {
        $config        = array('slug' => $entity->getSlug());

        $urls = array(
            'base' => $this->router->getContext()->getBaseUrl(),
            'asset' => $this->assetBaseUrl,
            'element' => $this->router->generate('mapbender_core_application_element', $config),
            'proxy' => $this->urlProcessor->getProxyBaseUrl(),
            'config' => $this->router->generate('mapbender_core_application_configuration', $config),
        );

        return $urls;
    }

    /**
     * Returns layerset configs.
     *
     * @param Application $entity
     * @return array[]
     */
    public function getLayerSetConfigs(Application $entity)
    {
        $configs = array();
        foreach ($entity->getLayersets() as $layerSet) {
            $configs[] = array(
                'id' => strval($layerSet->getId()),
                'title' => $layerSet->getTitle() ?: strval($layerSet->getId()),
                'instances' => $this->getSourceInstanceConfigs($layerSet),
            );
        }
        return $configs;
    }

    /**
     * @param Layerset $layerset
     * @return array[]
     */
    protected function getSourceInstanceConfigs(Layerset $layerset)
    {
        $configs = array();
        foreach ($this->filterActiveSourceInstanceAssignments($layerset) as $assignment) {
            $sourceService = $this->getSourceService($assignment->getInstance());
            if (!$sourceService) {
                // @todo: throw?
                continue;
            }
            // @todo: move check into prefilter (get service twice?)
            if (!$sourceService->isInstanceEnabled($assignment->getInstance())) {
                continue;
            }
            $conf = $sourceService->getConfiguration($assignment->getInstance());
            if (!$conf) {
                // @todo: throw?
                continue;
            }

            $configs[] = $conf;
        }
        return $configs;
    }

    /**
     * @param Entity\Element[] $elements
     * @return mixed[]
     */
    protected function getElementConfiguration($elements)
    {
        $elementConfig = array();
        foreach ($elements as $element) {
            $service = $this->elementFactory->getInventory()->getHandlerService($element, true);
            if ($service) {
                $values = array(
                    'init' => $service->getWidgetName($element),
                    'configuration' => $service->getClientConfiguration($element),
                );
            } else {
                try {
                    $component = $this->elementFactory->componentFromEntity($element, true);
                } catch (ElementErrorException $e) {
                    // for frontend presentation, incomplete / invalid elements are silently suppressed
                    // => do nothing
                    continue;
                }

                $values = array(
                    'init' => $component->getWidgetName(),
                    'configuration' => $component->getPublicConfiguration(),
                );
            }

            $elementConfig[$element->getId()] = $values;
        }
        return $elementConfig;
    }

    /**
     * Get the concrete service that deals with the concrete SourceInstance type.
     *
     * @param SourceInstance $sourceInstance
     * @return SourceService|null
     */
    protected function getSourceService(SourceInstance $sourceInstance)
    {
        // delegate to directory
        return $this->sourceTypeDirectory->getSourceService($sourceInstance);
    }

    /**
     * Extracts active source instances from given Layerset entity.
     *
     * @param Layerset $entity
     * @return SourceInstanceAssignment[]
     */
    protected static function filterActiveSourceInstanceAssignments(Layerset $entity)
    {
        $isYamlApp = $entity->getApplication()->isYamlBased();
        $active = array();
        foreach ($entity->getCombinedInstanceAssignments() as $assignment) {
            if ($isYamlApp || $assignment->getEnabled()) {
                $active[] = $assignment;
            }
        }
        return $active;
    }

    /**
     * @return ApplicationDataService
     */
    public function getCacheService()
    {
        return $this->cacheService;
    }
}
