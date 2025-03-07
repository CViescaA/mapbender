<?php

namespace Mapbender\CoreBundle\Element;

use Mapbender\Component\Element\AbstractElementService;
use Mapbender\Component\Element\TemplateView;
use Mapbender\CoreBundle\Entity\Element;

class Sketch extends AbstractElementService
{

    /**
     * @inheritdoc
     */
    public static function getClassTitle()
    {
        return "mb.core.sketch.class.title";
    }

    /**
     * @inheritdoc
     */
    public static function getClassDescription()
    {
        return "mb.core.sketch.class.description";
    }

    /**
     * @inheritdoc
     */
    public function getWidgetName(Element $element)
    {
        return 'mapbender.mbSketch';
    }

    /**
     * @inheritdoc
     */
    public function getRequiredAssets(Element $element)
    {
        return array(
            'js' => array(
                '@MapbenderCoreBundle/Resources/public/element/sketch.js',
                '@FOMCoreBundle/Resources/public/js/widgets/dropdown.js',
            ),
            'css' => array(
                '@MapbenderCoreBundle/Resources/public/element/sketch.scss',
            ),
            'trans' => array(
                'mb.core.sketch.*',
            ),
        );
    }

    /**
     * @inheritdoc
     */
    public static function getDefaultConfiguration()
    {
        return array(
            "target" => null,
            "auto_activate" => false,
            "deactivate_on_close" => true,
            "geometrytypes" => array(
                "point",
                "line",
                "polygon",
                "rectangle",
                "circle",
            ),
        );
    }

    /**
     * @inheritdoc
     */
    public static function getType()
    {
        return 'Mapbender\CoreBundle\Element\Type\SketchAdminType';
    }

    /**
     * @inheritdoc
     */
    public static function getFormTemplate()
    {
        return 'MapbenderCoreBundle:ElementAdmin:sketch.html.twig';
    }

    public function getClientConfiguration(Element $element)
    {
        return array_replace($element->getConfiguration(), array(
            'title' => $element->getTitle(),
        ));
    }

    public function getView(Element $element)
    {
        $view = new TemplateView('MapbenderCoreBundle:Element:sketch.html.twig');
        $view->attributes['class'] = 'mb-element-sketch';
        $view->variables['geometrytypes'] = $element->getConfiguration()['geometrytypes'];
        return $view;
    }
}
