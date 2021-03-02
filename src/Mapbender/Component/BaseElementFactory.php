<?php


namespace Mapbender\Component;


use Mapbender\CoreBundle\Component\ElementInventoryService;
use Mapbender\CoreBundle\Component\Exception\UndefinedElementClassException;
use Mapbender\CoreBundle\Entity\Element;

class BaseElementFactory
{
    /** @var ElementInventoryService */
    protected $inventoryService;

    public function __construct(ElementInventoryService $inventoryService)
    {
        $this->inventoryService = $inventoryService;
    }

    /**
     * Updates legacy 'class' property values for migrated / moved Element classes.
     *
     * @param Element $element
     * @throws UndefinedElementClassException
     * @throws \LogicException
     */
    public function migrateElementClass(Element $element)
    {
        if (!$element->getClass()) {
            throw new \LogicException("Empty component class name on element");
        }
        $componentClassName = $this->getComponentClass($element);
        if (!ClassUtil::exists($componentClassName)) {
            throw new UndefinedElementClassException($componentClassName);
        }
        $element->setClass($componentClassName);
    }

    /**
     * Updates legacy values in Element's $configuration attribute (YAML applications, old database installs) to
     * current standards.
     * By default also implicitly update legacy 'class' property values.
     *
     * @param Element $element
     * @param bool $migrateClass
     * @throws UndefinedElementClassException
     * @throws \LogicException
     */
    public function migrateElementConfiguration(Element $element, $migrateClass = true)
    {
        if ($migrateClass) {
            $this->migrateElementClass($element);
        }
        $componentClassName = $element->getClass();
        if (is_a($componentClassName, 'Mapbender\CoreBundle\Component\ElementBase\ConfigMigrationInterface', true)) {
            /** @var \Mapbender\CoreBundle\Component\ElementBase\ConfigMigrationInterface $componentClassName */
            // Avoid trying to migrate unconfigured elements further
            // This allows updateEntityConfig implementations to skip past a bunch of array_key_exists and similar
            // checks, which would otherwise be necessary on newly created and dummy entities
            if ($element->getConfiguration()) {
                $componentClassName::updateEntityConfig($element);
            }
        }
    }

    /**
     * @param string $className
     * @return bool
     */
    public function isClassDisabled($className)
    {
        return $this->inventoryService->isClassDisabled($className);
    }

    /**
     * @param Element $element
     * @return bool
     */
    public function isElementTypeDisabled(Element $element)
    {
        $disabled = $this->isClassDisabled($element->getClass());
        if (!$disabled && \is_a($element->getClass(), 'Mapbender\CoreBundle\Element\ControlButton', true)) {
            $target = $element->getTargetElement();
            if ($target) {
                $disabled = $this->isClassDisabled($target->getClass());
            }
        }
        return $disabled;
    }

    /**
     * @param Element $element
     * @return string|\Mapbender\CoreBundle\Component\Element
     */
    protected function getComponentClass(Element $element)
    {
        return $this->inventoryService->getAdjustedElementClassName($element->getClass());
    }
}
