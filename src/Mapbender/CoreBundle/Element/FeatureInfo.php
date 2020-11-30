<?php

namespace Mapbender\CoreBundle\Element;

use Mapbender\CoreBundle\Component\Element;
use Symfony\Component\Templating\EngineInterface;

/**
 * Featureinfo element
 *
 * This element will provide feature info for most layer types
 *
 * @author Christian Wygoda
 */
class FeatureInfo extends Element
{

    /**
     * @inheritdoc
     */
    public static function getClassTitle()
    {
        return "mb.core.featureinfo.class.title";
    }

    /**
     * @inheritdoc
     */
    public static function getClassDescription()
    {
        return "mb.core.featureinfo.class.description";
    }

    /**
     * @inheritdoc
     */
    public function getPublicConfiguration()
    {
        $config = $this->entity->getConfiguration();
        $defaults = self::getDefaultConfiguration();
        if (empty($config['width'])) {
            $config['width'] = $defaults['width'];
        }
        if (empty($config['height'])) {
            $config['height'] = $defaults['height'];
        }
        if (empty($config['maxCount']) || $config['maxCount'] < 0) {
            $config['maxCount'] = $defaults['maxCount'];
        }
        /** @var EngineInterface $templating */
        $templating = $this->container->get('templating');
        $iframeScripts = array(
            $templating->render('@MapbenderCoreBundle/Resources/public/element/featureinfo-mb-action.js'),
        );
        if ($config['highlighting']) {
            $iframeScripts[] = $templating->render('@MapbenderCoreBundle/Resources/public/element/featureinfo-highlighting.js');
        }
        $config['iframeInjection'] = implode("\n\n", $iframeScripts);
        return $config;
    }

    /**
     * @inheritdoc
     */
    public static function getDefaultConfiguration()
    {
        return array(
            'type' => 'dialog',
            "autoActivate" => false,
            "deactivateOnClose" => true,
            "printResult" => false,
            "onlyValid" => false,
            "displayType" => 'tabs',
            "target" => null,
            "width" => 700,
            "height" => 500,
            "maxCount" => 100,
            'highlighting' => false,
        );
    }

    /**
     * @inheritdoc
     */
    public function getWidgetName()
    {
        return 'mapbender.mbFeatureInfo';
    }

    /**
     * @inheritdoc
     */
    public static function getType()
    {
        return 'Mapbender\CoreBundle\Element\Type\FeatureInfoAdminType';
    }

    /**
     * @inheritdoc
     */
    public function getAssets()
    {
        return array(
            'js' => array(
                '@MapbenderCoreBundle/Resources/public/mapbender.element.featureInfo.js',
                '@FOMCoreBundle/Resources/public/js/frontend/tabcontainer.js',
            ),
            'css' => array(
                '@MapbenderCoreBundle/Resources/public/sass/element/featureinfo.scss',
            ),
            'trans' => array(
                'mb.core.featureinfo.error.*',
            ),
        );
    }

    public function getFrontendTemplatePath($suffix = '.html.twig')
    {
        return 'MapbenderCoreBundle:Element:featureinfo.html.twig';
    }

    /**
     * @inheritdoc
     */
    public function render()
    {
        $configuration = parent::getConfiguration();
        return $this->container->get('templating')
                ->render($this->getFrontendTemplatePath(), array(
                    'id' => $this->getId(),
                    'configuration' => $configuration,
                    'title' => $this->getTitle(),
        ));
    }

    /**
     * @inheritdoc
     */
    public static function getFormTemplate()
    {
        return 'MapbenderCoreBundle:ElementAdmin:featureinfo.html.twig';
    }
}
