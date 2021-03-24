<?php


namespace Mapbender\CoreBundle\Element;

use Mapbender\CoreBundle\Component\Element;
use Symfony\Component\HttpFoundation\Request;


class ViewManager extends Element
{
    const ACCESS_READWRITE = 'rw';
    const ACCESS_READONLY = 'ro';

    public static function getClassTitle()
    {
        return 'mb.core.viewManager.class.title';
    }

    public static function getClassDescription()
    {
        return 'mb.core.viewManager.class.description';
    }

    public function getWidgetName()
    {
        return 'mapbender.mbViewManager';
    }

    public function getFrontendTemplatePath()
    {
        return 'MapbenderCoreBundle:Element:view_manager.html.twig';
    }

    public function getAssets()
    {
        return array(
            'js' => array(
                '@MapbenderCoreBundle/Resources/public/element/mbViewManager.js',
            ),
            'css' => array(
                '@MapbenderCoreBundle/Resources/public/element/mbViewManager.scss',
            ),
            'trans' => array(),
        );
    }

    public static function getType()
    {
        return 'Mapbender\CoreBundle\Element\Type\ViewManagerAdminType';
    }

    public static function getFormTemplate()
    {
        return 'MapbenderCoreBundle:ElementAdmin:view_manager.html.twig';
    }

    public static function getDefaultConfiguration()
    {
        return array(
            'publicEntries' => self::ACCESS_READONLY,
            'privateEntries' => self::ACCESS_READWRITE,
            'allowAnonymousSave' => false,
            'allowNonAdminDelete' => false,
        );
    }

    public function getFrontendTemplateVars()
    {
        $config = $this->entity->getConfiguration() + $this->getDefaultConfiguration();
        return array(
            'showSaving' => ($config['publicEntries'] === self::ACCESS_READWRITE || $config['privateEntries'] === self::ACCESS_READWRITE),
            'showListSelector' => !empty($config['publicEntries']) && !empty($config['privateEntries']),
        );
    }

    public function handleHttpRequest(Request $request)
    {
        /** @var ViewManagerHttpHandler $handler */
        $handler = $this->container->get('mb.element.view_manager.http_handler');
        // Extend with defaults
        $this->entity->setConfiguration($this->entity->getConfiguration() + $this->getDefaultConfiguration());
        return $handler->handleHttpRequest($this->entity, $request);
    }
}
