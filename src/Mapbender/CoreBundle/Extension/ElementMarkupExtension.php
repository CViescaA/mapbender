<?php


namespace Mapbender\CoreBundle\Extension;

use Mapbender\CoreBundle\Component;
use Mapbender\CoreBundle\Component\Template;
use Mapbender\CoreBundle\Element\Map;
use Mapbender\CoreBundle\Entity;
use Mapbender\CoreBundle\Entity\Application;
use Mapbender\Exception\Application\MissingMapElementException;
use Mapbender\Exception\Application\MultipleMapElementsException;
use Symfony\Bundle\TwigBundle\TwigEngine;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class ElementMarkupExtension extends AbstractExtension
{
    /** @var Component\Presenter\ApplicationService */
    protected $appService;
    /** @var TwigEngine */
    protected $templatingEngine;
    /** @var bool */
    protected $debug;
    /** @var string */
    protected $bufferedHash;
    /** @var Map */
    protected $mapElement;
    /** @var Component\Element[][] */
    protected $anchoredContentElements;
    /** @var Component\Element[] */
    protected $unanchoredContentElements;
    /** @var Component\Element[][] */
    protected $nonContentRegionMap;
    /** @var array */
    protected $regionProperties;

    /**
     * @param Component\Presenter\ApplicationService $appService
     * @param TwigEngine $templatingEngine
     * @param bool $debug
     */
    public function __construct(Component\Presenter\ApplicationService $appService,
                                $templatingEngine,
                                $debug)
    {
        $this->appService = $appService;
        $this->templatingEngine = $templatingEngine;
        $this->debug = $debug;
    }

    /**
     * @inheritdoc
     */
    public function getName()
    {
        return 'mapbender_element_markup';
    }

    /**
     * @inheritdoc
     */
    public function getFunctions()
    {
        return array(
            'region_markup' => new TwigFunction('region_markup', array($this, 'region_markup')),
            'region_content' => new TwigFunction('region_content', array($this, 'region_content')),
            'anchored_content_elements' => new TwigFunction('anchored_content_elements', array($this, 'anchored_content_elements')),
            'unanchored_content_elements' => new TwigFunction('unanchored_content_elements', array($this, 'unanchored_content_elements')),
            'map_markup' => new TwigFunction('map_markup', array($this, 'map_markup')),
            'element_visibility_class' => new TwigFunction('element_visibility_class', array($this, 'element_visibility_class')),
        );
    }

    /**
     * @param Application $application
     * @return string
     */
    public function map_markup(Application $application)
    {
        $this->updateBuffers($application);
        if (!$this->mapElement) {
            if ($this->debug) {
                throw new MissingMapElementException("Invalid application: missing map element");
            } else {
                return '';
            }
        }

        return $this->renderComponents(array($this->mapElement));
    }

    /**
     * @param Application $application
     * @param $regionName
     * @param bool $suppressEmptyRegion
     * @return string
     */
    public function region_markup(Application $application, $regionName, $suppressEmptyRegion = true)
    {
        if (false !== strpos($regionName, 'content')) {
            throw new \LogicException("No support for 'content' region in region_markup");
        }
        $this->updateBuffers($application);
        if (!empty($this->nonContentRegionMap[$regionName])) {
            $elements = $this->nonContentRegionMap[$regionName];
        } else {
            $elements = array();
        }
        if ($elements || !$suppressEmptyRegion) {
            $template = $this->getTemplateDescriptor($application);
            $skin = $template->getRegionTemplate($application, $regionName);
            $vars = array_replace($template->getRegionTemplateVars($application, $regionName), array(
                'elements' => $elements,
                'region_name' => $regionName,
                'application' => $application,
            ));
            return $this->templatingEngine->render($skin, $vars);
        } else {
            return '';
        }
    }

    /**
     * @param Application $application
     * @param string $regionName
     * @return string
     */
    public function region_content(Application $application, $regionName)
    {
        $this->updateBuffers($application);
        if ($regionName === 'content') {
            return $this->unanchored_content_elements($application);
        } elseif (!empty($this->nonContentRegionMap[$regionName])) {
            $glue = $this->getRegionGlue($regionName);
            return $this->renderComponents($this->nonContentRegionMap[$regionName], $glue);
        } else {
            return '';
        }
    }

    /**
     * @param Application $application
     * @return string
     */
    public function unanchored_content_elements(Application $application)
    {
        $this->updateBuffers($application);
        return $this->renderComponents($this->unanchoredContentElements);
    }

    /**
     * @param Application $application
     * @param string|null $anchorValue empty for everything in sequence, or one of "top-left", "top-right", "bottom-left", "bottom-right"
     * @return string
     */
    public function anchored_content_elements(Application $application, $anchorValue = null)
    {
        $this->updateBuffers($application);
        if (!$anchorValue) {
            $validAnchors = Template::getValidOverlayAnchors();
            $parts = array();
            foreach ($validAnchors as $anchorValue) {
                $parts[] = $this->anchored_content_elements($application, $anchorValue);
            }
            return implode('', $parts);
        }
        if (!empty($this->anchoredContentElements[$anchorValue])) {
            return $this->renderComponents($this->anchoredContentElements[$anchorValue], array(
                'tagName' => 'div',
                'class' => 'element-wrapper'
            ));
        } else {
            return '';
        }
    }

    /**
     * @param Entity\Element|Component\Element $element
     * @return string|null
     */
    public function element_visibility_class($element)
    {
        return $this->getElementVisibilityClass($this->normalizeElementEntityArgument($element));
    }

    /**
     * @param Component\Element[] $components
     * @param string[]|null $wrapper if not empty, must have entries "tagName" (string), "class" (string)
     * @return string
     */
    protected function renderComponents($components, $wrapper = null)
    {
        $wrappers = array_filter(array($wrapper));
        $defaultWrapperMarkup = $this->renderWrappers($wrappers);

        $markupFragments = array();
        foreach ($components as $component) {
            $elementWrapper = $this->getElementWrapper($component->getEntity());
            if ($elementWrapper) {
                $elementWrapMarkup = $this->renderWrappers(array_merge($wrappers, array($elementWrapper)));
            } else {
                $elementWrapMarkup = $defaultWrapperMarkup;
            }
            $markupFragments[] = $elementWrapMarkup['open'];
            $markupFragments[] = $component->render();
            $markupFragments[] = $elementWrapMarkup['close'];
        }
        return implode('', $markupFragments);
    }

    /**
     * @param Entity\Element $element
     * @return string[]|null
     */
    protected function getElementWrapper(Entity\Element $element)
    {
        $visibilityClass = $this->getElementVisibilityClass($element);
        if ($visibilityClass) {
            return array(
                'tagName' => 'div',
                'class' => $visibilityClass,
            );
        } else {
            return null;
        }
    }

    /**
     * @param Entity\Element $element
     * @return string|null
     */
    protected function getElementVisibilityClass(Entity\Element $element)
    {
        // @todo screen-type visibility filter
        // if ($element->getScrrenTypes !== 'both') return '...';
        return null;
    }

    /**
     * @param (string[]|null)[] $wrappers
     * @return string[] with entries 'open', 'close'
     */
    protected function renderWrappers($wrappers)
    {
        $tagName = null;
        $classes = array();
        foreach ($wrappers ?: array() as $wrapper) {
            // use tag name from first wrapper entry
            if ($tagName === null) {
                $tagName = $wrapper['tagName'];
            }
            // concatenate all classes
            $classes[] = $wrapper['class'];
        }
        if (!$tagName) {
            return array(
                'open' => '',
                'close' => '',
            );
        } else {
            return array(
                'open' => '<' . $tagName . ' class="' . implode(' ', $classes) . '">',
                'close' => "</{$tagName}>",
            );
        }
    }

    /**
     * @param Application $application
     */
    protected function updateBuffers(Application $application)
    {
        $hash = spl_object_hash($application);
        if ($this->bufferedHash !== $hash) {
            $this->initializeBuffers($application);
            $this->bufferedHash = $hash;
        }
    }

    /**
     * @param Application $application
     */
    protected function initializeBuffers(Application $application)
    {
        $granted = $this->appService->getActiveElements($application);
        $this->mapElement = null;
        $this->nonContentRegionMap = array();
        $this->anchoredContentElements = array();
        $this->unanchoredContentElements = array();
        foreach ($granted as $elementComponent) {
            $elementEntity = $elementComponent->getEntity();
            $region = $elementEntity->getRegion();
            if ($elementComponent instanceof Map) {
                if ($this->mapElement) {
                    throw new MultipleMapElementsException("Invalid application: multiple map elements");
                }
                $this->mapElement = $elementComponent;
            } elseif ($region !== 'content') {
                if (!isset($this->nonContentRegionMap[$region])) {
                    $this->nonContentRegionMap[$region] = array();
                }
                $this->nonContentRegionMap[$region][] = $elementComponent;
            } else {
                // @todo: migrate config? already done?
                $config = $elementEntity->getConfiguration();
                if (!empty($config['anchor'])) {
                    $anchor = $config['anchor'];
                    if (!isset($this->anchoredContentElements[$anchor])) {
                        $this->anchoredContentElements[$anchor] = array();
                    }
                    $this->anchoredContentElements[$anchor][] = $elementComponent;
                } else {
                    $this->unanchoredContentElements[] = $elementComponent;
                }
            }
        }
        $this->regionProperties = $application->getNamedRegionProperties();
    }

    /**
     * @param string $regionName
     * @return string
     */
    protected static function normalizeRegionName($regionName)
    {
        // Legacy lenience in patterns: allow postfixes / prefixes around region names, e.g.
        // "some-custom-project-footer"
        if (false !== strpos($regionName, 'footer')) {
            return 'footer';
        } elseif (false !== strpos($regionName, 'toolbar')) {
            return 'toolbar';
        } elseif (false !== strpos($regionName, 'sidepane')) {
            return 'sidepane';
        } elseif (false !== strpos($regionName, 'content')) {
            return 'content';
        } else {
            // fingers crossed
            return $regionName;
        }
    }

    /**
     * Detect appropriate Element markup wrapping tag for a named region.
     *
     * @param string $regionName
     * @return string[]|null
     */
    protected static function getRegionGlue($regionName)
    {
        switch (static::normalizeRegionName($regionName)) {
            case 'footer':
            case 'toolbar':
                return array(
                    'tagName' => 'li',
                    'class' => 'toolBarItem',
                );
            case 'sidepane':
                // @todo: unify this
                return null;
            default:
                return null;
        }
    }

    /**
     * @param Application $application
     * @return Template
     */
    protected static function getTemplateDescriptor(Application $application)
    {
        /** @var string|Template $templateCls */
        $templateCls = $application->getTemplate();
        /** @var Template $templateObj */
        $templateObj = new $templateCls();
        if (!($templateObj instanceof Template)) {
            throw new \LogicException("Invalid template class " . get_class($templateObj));
        }
        return $templateObj;
    }

    /**
     * @param Entity\Element|Component\Element $element
     * @return Entity\Element
     * @throws \InvalidArgumentException
     */
    protected function normalizeElementEntityArgument($element)
    {
        // normalize to entity
        if ($element instanceof Component\Element) {
            $element = $element->getEntity();
        }
        if (!$element instanceof Entity\Element) {
            throw new \InvalidArgumentException("Unsupported type " . ($element && \is_object($element)) ? \get_class($element) : gettype($element));
        }
        return $element;
    }
}
