<?php


namespace Mapbender\CoreBundle\Component;


use Mapbender\Component\Element\AbstractElementService;
use Mapbender\CoreBundle\Entity\Element;

/**
 * Maintains inventory of Element Component classes
 *
 * Default implementation for service mapbender.element_inventory.service
 * @since v3.0.8-beta1
 */
class ElementInventoryService
{
    /** @var string[] */
    protected $movedElementClasses = array(
        'Mapbender\CoreBundle\Element\PrintClient' => 'Mapbender\PrintBundle\Element\PrintClient',
        // see https://github.com/mapbender/data-source/tree/0.1.8/Element
        'Mapbender\DataSourceBundle\Element\DataManagerElement' => 'Mapbender\DataManagerBundle\Element\DataManagerElement',
        'Mapbender\DataSourceBundle\Element\DataStoreElement' => 'Mapbender\DataManagerBundle\Element\DataManagerElement',
        'Mapbender\DataSourceBundle\Element\QueryBuilderElement' => 'Mapbender\QueryBuilderBundle\Element\QueryBuilderElement',
        'Mapbender\CoreBundle\Element\Redlining' => 'Mapbender\CoreBundle\Element\Sketch',
    );

    /** @var string[] */
    protected $fullInventory = array();
    /** @var string[] */
    protected $noCreationClassNames = array();
    /** @var string[] */
    protected $disabledClassesFromConfig = array();
    /** @todo: prefer an interface type */
    /** @var AbstractElementService[] */
    protected $serviceElements = array();

    public function __construct($disabledClasses)
    {
        $this->disabledClassesFromConfig = $disabledClasses ?: array();
    }

    /**
     * @param string $classNameIn
     * @return string
     */
    public function getAdjustedElementClassName($classNameIn)
    {
        if (!empty($this->movedElementClasses[$classNameIn])) {
            $classNameOut = $this->movedElementClasses[$classNameIn];
            return $classNameOut;
        } else {
            return $classNameIn;
        }
    }

    /**
     * @param Element $element
     * @param bool $adjustClass
     * @return AbstractElementService|null
     * @todo: prefer interface type hinting
     */
    public function getHandlerService(Element $element, $adjustClass = false)
    {
        $className = $element->getClass();
        if ($adjustClass) {
            $className = $this->getAdjustedElementClassName($className);
        }
        if (!empty($this->serviceElements[$className])) {
            return $this->serviceElements[$className];
        } else {
            return null;
        }
    }

    /**
     * @param string[] $classNames
     */
    public function setInventory($classNames)
    {
        // map value:value to ease array_intersect_key in getActiveInventory
        $this->fullInventory = array_combine($classNames, $classNames);
    }

    /**
     * @param AbstractElementService $instance
     * @param string[] $handledClassNames
     * @todo: prefer an interface type
     * @noinspection PhpUnused
     * @see \Mapbender\FrameworkBundle\DependencyInjection\Compiler\RegisterElementServicesPass::process()
     */
    public function registerService(AbstractElementService $instance, $handledClassNames)
    {
        $serviceClass = \get_class($instance);
        $handledClassNames = array_diff($handledClassNames, $this->getDisabledClasses());
        foreach (array_unique($handledClassNames) as $handledClassName) {
            $this->serviceElements[$handledClassName] = $instance;
            if ($handledClassName !== $serviceClass) {
                $this->replaceElement($handledClassName, $serviceClass);
            }
        }
    }

    /**
     * Marks $classNameTo as the acting replacement for $classNameFrom.
     *
     * @param string $classNameFrom
     * @param string $classNameTo
     */
    public function replaceElement($classNameFrom, $classNameTo)
    {
        if (!$classNameFrom || !$classNameTo) {
            throw new \InvalidArgumentException("Empty class name");
        }
        if ($classNameFrom == $classNameTo) {
            throw new \LogicException("Cannot replace {$classNameFrom} with itself");
        }
        // support layered replacements
        while ($inMoved = array_search($classNameFrom, $this->movedElementClasses)) {
            $this->movedElementClasses[$inMoved] = $classNameTo;
        }
        $this->movedElementClasses[$classNameFrom] = $classNameTo;
        $circular = array_intersect(array_values($this->movedElementClasses), array_keys($this->movedElementClasses));
        if ($circular) {
            throw new \LogicException("Circular class replacement detected for " . implode(', ', $circular));
        }
    }

    /**
     * Disables the Element of given $className insofar that it can no longer be added to
     * any applications.
     *
     * @param string $className
     */
    public function disableElementCreation($className)
    {
        if (!$className) {
            throw new \InvalidArgumentException("Class name empty");
        }
        $this->noCreationClassNames[] = $className;
        $this->noCreationClassNames = array_unique(array_merge($this->noCreationClassNames));
    }

    /**
     * Returns the Element class inventory after taking into account renamed and disabled classes.
     *
     * @return string[]
     */
    public function getActiveInventory()
    {
        $moved = array_intersect_key($this->movedElementClasses, $this->fullInventory);
        $inventoryCopy = $this->fullInventory + array();
        foreach ($moved as $original => $replacement) {
            $inventoryCopy[$original] = $replacement;
        }
        return array_unique(array_diff(array_values($inventoryCopy), $this->noCreationClassNames, $this->getDisabledClasses()));
    }

    /**
     * Returns the full, unmodified Element class inventory advertised by the sum of enabled MapbenderBundles.
     *
     * @return string[]
     */
    public function getRawInventory()
    {
        return array_values($this->fullInventory);
    }

    protected function getDisabledClasses()
    {
        return array_merge($this->disabledClassesFromConfig, $this->getInternallyDisabledClasses());
    }

    public function isClassDisabled($className)
    {
        return \in_array($className, $this->getDisabledClasses());
    }

    protected function getInternallyDisabledClasses()
    {
        return array(
            'Mapbender\WmcBundle\Element\WmcLoader',
            'Mapbender\WmcBundle\Element\WmcList',
            'Mapbender\WmcBundle\Element\WmcEditor',
        );
    }
}
