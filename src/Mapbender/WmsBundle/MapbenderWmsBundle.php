<?php

namespace Mapbender\WmsBundle;

use Mapbender\CoreBundle\Component\MapbenderBundle;

/**
 * 
 */
class MapbenderWmsBundle
        extends MapbenderBundle
{
    /**
     * @inheritdoc
     */
    public function getElements()
    {
        return array(
            'Mapbender\WmsBundle\Element\WmsLoader'
            );
    }

    /**
     * @inheritdoc
     */
    public function getRepositoryManagers()
    {
        return array(
            'wms' => array(
                'id' => 'wms',
                'label' => 'OGC WMS',
                'manager' => 'mapbender_wms_repository',
                'startAction' => "MapbenderWmsBundle:Repository:start",
                'updateAction' => "MapbenderWmsBundle:Repository:update",
                'bundle' => "MapbenderWmsBundle"
            )
        );
    }

}
