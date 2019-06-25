<?php

namespace Mapbender\CoreBundle\DependencyInjection\Compiler;

use Mapbender\CoreBundle\MapbenderCoreBundle;
use Symfony\Component\Config\Resource\FileResource;
use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\Finder\Finder;
use Symfony\Component\Yaml\Yaml;

/**
 * Class MapbenderYamlCompilerPass
 *
 * Need to load and create bundle application cache.
 * @see MapbenderCoreBundle::build()
 *
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class MapbenderYamlCompilerPass implements CompilerPassInterface
{
    /** @var string Applications directory path where YAML files are */
    protected $applicationDir;

    /**
     * MapbenderYamlCompilerPass constructor.
     *
     * @param string             $applicationDir       Applications directory path
     */
    public function __construct($applicationDir)
    {
        if ($applicationDir) {
            $this->applicationDir = $applicationDir;
        }
    }

    /**
     * @param ContainerBuilder $container Container
     */
    public function process(ContainerBuilder $container)
    {
        if ($this->applicationDir) {
            $this->loadYamlApplications($container, $this->applicationDir);
        }
    }

    /**
     * Load YAML applications from path
     *
     *
     * @param ContainerBuilder $container
     * @param string $path Application directory path
     */
    protected function loadYamlApplications($container, $path)
    {
        $finder = new Finder();
        $finder
            ->in($path)
            ->files()
            ->name('*.yml');
        $applications = array();

        foreach ($finder as $file) {
            $fileData = Yaml::parse($file->getRealPath());
            if (!empty($fileData['parameters']['applications'])) {
                foreach ($fileData['parameters']['applications'] as $slug => $appDefinition) {
                    $applications[$slug] = $this->processApplicationDefinition($slug, $appDefinition);
                }
                // Add a file resource to auto-invalidate the container build when the input file changes
                $container->addResource(new FileResource($file->getRealPath()));
            }
        }
        $this->addApplications($container, $applications);
    }

    /**
     * @param ContainerBuilder $container
     * @param array[][] $applications
     */
    protected function addApplications($container, $applications)
    {
        if ($applications) {
            if ($container->hasParameter('applications')) {
                $applicationCollection = $container->getParameter('applications');
                $applicationCollection = array_replace($applicationCollection, $applications);
            } else {
                $applicationCollection = $applications;
            }
            $container->setParameter('applications', $applicationCollection);
        }
    }

    /**
     * @param string $slug
     * @param array $definition
     * @return array
     */
    protected function processApplicationDefinition($slug, $definition)
    {
        if (!isset($definition['layersets'])) {
            if (isset($definition['layerset'])) {
                // @todo: add strict mode support and throw if enabled
                @trigger_error("Deprecated: your YAML application {$slug} defines legacy 'layerset' (single item), should define 'layersets' (array)", E_USER_DEPRECATED);
                $definition['layersets'] = array($definition['layerset']);
            } else {
                $definition['layersets'] = array();
            }
        }
        unset($definition['layerset']);
        if (!empty($definition['elements'])) {
            foreach ($definition['elements'] as $region => $elementDefinitionList) {
                foreach ($elementDefinitionList as $elementIndex => $elementDefinition) {
                    $definition['elements'][$region][$elementIndex] = $this->processElementDefinition($elementDefinition);
                }
            }
        } else {
            unset($definition['elements']);
        }
        return $definition;
    }

    /**
     * @param array $definition
     * @return array
     */
    protected function processElementDefinition($definition)
    {
        if ($definition['class'] == "Mapbender\\CoreBundle\\Element\\Map") {
            if (!isset($elementDefinition['layersets'])) {
                if (isset($definition['layerset'])) {
                    // @todo: add strict mode support and throw if enabled
                    @trigger_error("Deprecated: your YAML Map Element defines legacy 'layerset' (single item), should define 'layersets' (array)", E_USER_DEPRECATED);
                    $elementDefinition['layersets'] = array($definition['layerset']);
                } else {
                    $elementDefinition['layersets'] = array();
                }
            }
            unset($definition['layerset']);
        }
        return $definition;
    }
}
