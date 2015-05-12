<?php

namespace Mapbender\CoreBundle\DataFixtures\ORM\Application;

use Doctrine\Common\Persistence\ObjectManager;
use Doctrine\Common\DataFixtures\FixtureInterface;
use Symfony\Component\DependencyInjection\ContainerAwareInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Mapbender\CoreBundle\Entity\Application as ApplicationEntity;
use Mapbender\CoreBundle\Entity\Element;
use Mapbender\CoreBundle\Component\Element as ElementComponent;
use Mapbender\CoreBundle\Entity\Layerset;
use Symfony\Component\Security\Acl\Domain\RoleSecurityIdentity;
use Symfony\Component\Security\Acl\Permission\MaskBuilder;

/**
 * The class LoadApplicationData loads the applications from the "mapbender.yml"
 * into a mapbender database.
 *
 * @author Paul Schmidt
 */
class LoadApplicationData implements FixtureInterface, ContainerAwareInterface
{

    /**
     * Container
     *
     * @var ContainerInterface
     */
    private $container;

    private $mapper = array();

    /**
     * @inheritdoc
     */
    public function setContainer(ContainerInterface $container = NULL)
    {
        $this->container = $container;
    }

    /**
     * @inheritdoc
     */
    public function load(ObjectManager $manager)
    {
        $definitions = $this->container->getParameter('applications');
            $manager->getConnection()->beginTransaction();
        foreach ($definitions as $slug => $definition) {
            $appMapper = new \Mapbender\CoreBundle\Component\ApplicationYAMLMapper($this->container);
            $application = $appMapper->getApplication($slug);
            if ($application->getLayersets()->count() === 0) {
                continue;
            }
            $application->setSource(ApplicationEntity::SOURCE_DB);
//            $manager->persist($application);
            $this->saveLayersets($manager, $application);


        }
            $application->setAuto();
            $manager->getConnection()->commit();
    }
    
    private function addMapping($object, $id_old, $id_new)
    {
        $class = get_class($layerset);
        if (!isset($this->mapper[$class])) {
            $this->mapper[$class] = array();
        }
        $this->mapper[$class][$id_old] = $id_new;
    }

    private function saveLayersets(ObjectManager $manager, ApplicationEntity $application)
    {
        foreach ($application->getLayersets() as $layerset) {
            if (!isset($this->mapper[get_class($layerset)])) {
                $this->mapper[get_class($layerset)] = array();
            }
            $old_id = $layerset->getId();
            $layerset->setId(null);
            $this->mapper[get_class($layerset)][$old_id] = $layerset->getId();
        }
    }

    private function saveInstances(ObjectManager $manager, Layerset $layerset)
    {

        foreach ($layerset->getInstances() as $instance) {
//            $this->mapper
        }
    }

    private function saveElements(ObjectManager $manager, ApplicationEntity $application)
    {

        foreach ($application->getElements() as $element) {
//            $this->mapper
        }
    }



    /**
     * @inheritdoc
     */
    public function loadOld(ObjectManager $manager)
    {
        $definitions = $this->container->getParameter('applications');
        $manager->getConnection()->beginTransaction();
        foreach ($definitions as $slug => $definition) {
            if (isset($definition['excludeFromList']) && $definition['excludeFromList']) {
                continue;
            }
            $timestamp = round((microtime(true) * 1000));
            if (!key_exists('title', $definition)) {
                $definition['title'] = "TITLE " . $timestamp;
            }

            if (!key_exists('published', $definition)) {
                $definition['published'] = false;
            } else {
                $definition['published'] = (boolean) $definition['published'];
            }
            // First, create an application entity
            $application = new ApplicationEntity();
            $application
                ->setSlug($timestamp . "_" . $slug)
                ->setTitle($timestamp . " " . (isset($definition['title']) ? $definition['title'] : ''))
                ->setDescription(isset($definition['description']) ? $definition['description'] : '')
                ->setTemplate($definition['template'])
                ->setPublished(isset($definition['published']) ? $definition['published'] : false)
                ->setUpdated(new \DateTime('now'));
            if (array_key_exists('extra_assets', $definition)) {
                $application->setExtraAssets($definition['extra_assets']);
            }

            $application->yaml_roles = array();
            if (array_key_exists('roles', $definition)) {
                $application->yaml_roles = $definition['roles'];
            }
            $manager->persist($application);
            $layersets_map = array();
            foreach ($definition['layersets'] as $layersetName => $layersetDef) {
                $layerset = new Layerset();
                $layerset->setTitle($layersetName);
                $layerset->setApplication($application);
                $manager->persist($layerset);
                $application->addLayerset($layerset);
                $manager->flush();
                $layersets_map[$layersetName] = $layerset->getId();
            }
            $manager->persist($application);

            // Set inital ACL
            $aces = array();
            $aces[] = array(
                'sid' => new RoleSecurityIdentity('IS_AUTHENTICATED_ANONYMOUSLY'),
                'mask' => MaskBuilder::MASK_VIEW);

            $aclManager = $this->container->get('fom.acl.manager');
            $aclManager->setObjectACL($application, $aces, 'object');

            $elements_map = array();
            // Then create elements
            foreach ($definition['elements'] as $region => $elementsDefinition) {
                if ($elementsDefinition !== null) {
                    $weight = 0;
                    foreach ($elementsDefinition as $element_yml_id => $elementDefinition) {
                        $class = $elementDefinition['class'];
                        $title = array_key_exists('title', $elementDefinition)
                            && $elementDefinition['title'] !== null ?
                            $elementDefinition['title'] :
                            $class::getClassTitle();

                        $element = new Element();

                        $element->setClass($elementDefinition['class'])
                            ->setTitle($title)
                            ->setConfiguration($elementDefinition)
                            ->setRegion($region)
                            ->setWeight($weight++)
                            ->setApplication($application);
                        //TODO: Roles
                        $application->addElements($element);
                        $manager->persist($element);
                        $manager->flush();
                        $elements_map[$element_yml_id] = $element->getId();
                    }
                }
            }
            // Then merge default configuration and elements configuration
            foreach ($application->getElements() as $element) {
                $configuration_yml = $element->getConfiguration();
                $entity_class = $configuration_yml['class'];
                $appl = new \Mapbender\CoreBundle\Component\Application($this->container, $application, array());
                $elComp = new $entity_class($appl, $this->container, new Element());
                unset($configuration_yml['class']);
                unset($configuration_yml['title']);

                $configuration =
                    ElementComponent::mergeArrays($elComp->getDefaultConfiguration(), $configuration_yml, array());

                if (key_exists("target", $configuration)
                    && $configuration["target"] !== null
                    && key_exists($configuration["target"], $elements_map)) {
                    $configuration["target"] = $elements_map[$configuration["target"]];
                }
                if (key_exists("layerset", $configuration_yml)
                    && $configuration["layerset"] !== null
                    && key_exists($configuration["layerset"], $layersets_map)) {
                    $configuration["layerset"] = $layersets_map[$configuration["layerset"]];
                }

                $class = $elementDefinition['class'];
                $title = array_key_exists('title', $elementDefinition) ?
                    $elementDefinition['title'] :
                    $class::getClassTitle();
                $element->setConfiguration($configuration);
                $manager->persist($element);
            }
            $manager->flush();
            $ccc;
        }
        $manager->getConnection()->commit();
    }
}
