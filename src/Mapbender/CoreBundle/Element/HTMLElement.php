<?php

namespace Mapbender\CoreBundle\Element;

use Mapbender\CoreBundle\Component\Element;

/**
 * HTMLElement.
 */
class HTMLElement extends Element
{
    public static function getClassTitle()
    {
        return 'mb.core.htmlelement.class.title';
    }

    public static function getClassDescription()
    {
        return 'mb.core.htmlelement.class.description';
    }

    public function getWidgetName()
    {
        // no script constructor
        return false;
    }

    /**
     * @inheritdoc
     */
    public static function getType()
    {
        return 'Mapbender\CoreBundle\Element\Type\HTMLElementAdminType';
    }

    /**
     * @inheritdoc
     */
    public static function getDefaultConfiguration()
    {
        return array(
            'classes' => 'html-element-inline',
            'content' => ''
        );
    }

    public function getFrontendTemplateVars()
    {
        $config = $this->entity->getConfiguration();
        if (!empty($config['classes'])) {
            $cssClassNames = array_map('trim', explode(' ', $config['classes']));
        } else {
            $cssClassNames = array();
        }
        if (in_array('html-element-inline', $cssClassNames)) {
            $tagName = 'span';
        } else {
            $tagName = 'div';
        }
        return array(
            'configuration' => $config,
            'tagName' => $tagName,
            'application' => $this->entity->getApplication(),
        );
    }

    public function getFrontendTemplatePath($suffix = '.html.twig')
    {
        return 'MapbenderCoreBundle:Element:htmlelement.html.twig';
    }

    /**
     * @inheritdoc
     */
    public static function getFormTemplate()
    {
        return 'MapbenderCoreBundle:ElementAdmin:htmlelement.html.twig';
    }
}
