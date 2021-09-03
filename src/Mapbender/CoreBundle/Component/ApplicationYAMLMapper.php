<?php
namespace Mapbender\CoreBundle\Component;

use Mapbender\Component\Collections\YamlElementCollection;
use Mapbender\Component\Collections\YamlSourceInstanceCollection;
use Mapbender\Component\SourceInstanceFactory;
use Mapbender\CoreBundle\Component\Source\TypeDirectoryService;
use Mapbender\CoreBundle\Entity\Application;
use Mapbender\CoreBundle\Entity\Layerset;
use Mapbender\CoreBundle\Entity\RegionProperties;
use Mapbender\FrameworkBundle\Component\ElementEntityFactory;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * Converts array-style application definitions to Application entities.
 *
 * Service instance registered as mapbender.application.yaml_entity_repository
 * @todo: implement object repository interface
 * @todo: split factory from repository
 *
 * @author Christian Wygoda
 */
class ApplicationYAMLMapper
{
    /** @var LoggerInterface  */
    protected $logger;
    /** @var TypeDirectoryService */
    protected $sourceTypeDirectory;
    /** @var ElementEntityFactory */
    protected $elementFactory;
    /** @var array[] */
    protected $definitions;

    /**
     * @param array[] $definitions
     * @param ElementEntityFactory $elementFactory
     * @param SourceInstanceFactory $sourceInstanceFactory
     * @param LoggerInterface|null $logger
     */
    public function __construct($definitions,
                                ElementEntityFactory $elementFactory, SourceInstanceFactory $sourceInstanceFactory,
                                LoggerInterface $logger = null)
    {
        $this->definitions = $definitions;
        $this->elementFactory = $elementFactory;
        $this->sourceTypeDirectory = $sourceInstanceFactory;
        $this->logger = $logger ?: new NullLogger();
    }

    /**
     * Get all YAML applications
     *
     * @return Application[]
     */
    public function getApplications()
    {
        $applications = array();
        foreach ($this->definitions as $slug => $def) {
            $application = $this->getApplication($slug);
            if ($application !== null) {
                $applications[] = $application;
            }
        }

        return $applications;
    }

    /**
     * Get YAML application for given slug
     *
     * Will return null if no YAML application for the given slug exists.
     *
     * @param string $slug
     * @return Application|null
     */
    public function getApplication($slug)
    {
        if (!array_key_exists($slug, $this->definitions)) {
            return null;
        }
        $application = $this->createApplication($this->definitions[$slug], $slug);
        return $application;
    }

    /**
     * @param mixed[] $definition
     * @param string $slug
     * @return Application
     */
    public function createApplication(array $definition, $slug)
    {

        $timestamp = filemtime($definition['__filename__']);
        unset($definition['__filename__']);
        if (!array_key_exists('title', $definition)) {
            $definition['title'] = "TITLE " . $timestamp;
        }

        $application = new Application();
        $application->setId($slug);
        $application->setSlug($slug);
        $application->setUpdated(new \DateTime("@{$timestamp}"));
        $application
                ->setTitle(isset($definition['title'])?$definition['title']:'')
                ->setDescription(isset($definition['description'])?$definition['description']:'')
                ->setTemplate($definition['template'])
        ;
        if (isset($definition['published'])) {
            $application->setPublished($definition['published']);
        }
        if (!empty($definition['screenshot'])) {
            $application->setScreenshot($definition['screenshot']);
        }
        if (isset($definition['custom_css'])) {
            $application->setCustomCss($definition['custom_css']);
        }

        if (isset($definition['publicOptions'])) {
            $application->setPublicOptions($definition['publicOptions']);
        }
        
        if (isset($definition['mapEngineCode'])) {
            $application->setMapEngineCode($definition['mapEngineCode']);
        }
        if (isset($definition['persistentView'])) {
            $application->setPersistentView($definition['persistentView']);
        }
 
        if (array_key_exists('extra_assets', $definition)) {
            $application->setExtraAssets($definition['extra_assets']);
        }
        if (array_key_exists('regionProperties', $definition)) {
            foreach ($definition['regionProperties'] as $index => $regProps) {
                $regionProperties = new RegionProperties();
                $regionProperties->setId($application->getSlug() . ':' . $index);
                $regionProperties->setName($regProps['name']);
                $regionProperties->setProperties($regProps['properties']);
                $regionProperties->setApplication($application);
                $application->addRegionProperties($regionProperties);
            }
        }
        if (!empty($definition['elements'])) {
            $collection = new YamlElementCollection($this->elementFactory, $application, $definition['elements'], $this->logger);
            $application->setElements($collection);
        }

        $application->setYamlRoles(array_key_exists('roles', $definition) ? $definition['roles'] : array());
        if ($application->isPublished() && !$application->getYamlRoles()) {
            $application->setYamlRoles(array(
               'IS_AUTHENTICATED_ANONYMOUSLY',
            ));
        }

        foreach ($definition['layersets'] as $layersetId => $layersetDefinition) {
            $layerset = $this->createLayerset($layersetId, $layersetDefinition);
            $layerset->setApplication($application);
            $application->addLayerset($layerset);
        }
        $application->setSource(Application::SOURCE_YAML);
        Application::postLoadStatic($application);
        return $application;
    }

    /**
     * @param string $layersetId
     * @param mixed[] $layersetDefinition
     * @return Layerset
     */
    protected function createLayerset($layersetId, $layersetDefinition)
    {
        $layerset = new Layerset();
        $layerset
            ->setId($layersetId)
            ->setTitle(strval($layersetId))
        ;
        $instanceCollection = new YamlSourceInstanceCollection($this->sourceTypeDirectory, $layerset, $layersetDefinition);
        $layerset->setInstances($instanceCollection);
        return $layerset;
    }
}
