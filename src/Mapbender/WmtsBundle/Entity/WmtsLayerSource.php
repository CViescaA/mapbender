<?php

namespace Mapbender\WmtsBundle\Entity;

use Doctrine\ORM\Mapping as ORM;
use Mapbender\Component\Transformer\OneWayTransformer;
use Mapbender\Component\Transformer\Target\MutableUrlTarget;
use Mapbender\CoreBundle\Component\BoundingBox;
use Mapbender\CoreBundle\Entity\SourceItem;
use Mapbender\WmtsBundle\Component\Style;
use Mapbender\WmtsBundle\Component\TileMatrixSetLink;
use Mapbender\WmtsBundle\Component\UrlTemplateType;


/**
 * @author Paul Schmidt
 * @ORM\Entity
 * @ORM\Table(name="mb_wmts_wmtslayersource")
 *
 * @property WmtsSource $source
 * @method WmtsSource getSource
 */
class WmtsLayerSource extends SourceItem implements MutableUrlTarget
{

    /**
     * @ORM\Column(name="name", type="string", nullable=true)
     */
    protected $identifier = "";

    /**
     * @ORM\Column(type="text",nullable=true)
     */
    protected $abstract = "";

    /**
     * @ORM\ManyToOne(targetEntity="WmtsSource",inversedBy="layers")
     * @ORM\JoinColumn(name="wmtssource", referencedColumnName="id")
     */
    protected $source;

    /**
     * @ORM\Column(type="object", nullable=true)
     */
    protected $latlonBounds;
    
    /**
     * @ORM\Column(type="array", nullable=true)
     */
    protected $boundingBoxes;

    /**
     * @ORM\Column(type="array", nullable=true)
     */
    protected $styles;

    /**
     * @ORM\Column(type="array", nullable=true)
     */
    protected $infoformats;

    /**
     * @ORM\Column(type="array", nullable=true)
     */
    protected $tilematrixSetlinks;

    /**
     * @ORM\Column(type="array", nullable=true)
     */
    protected $resourceUrl;

    public function __construct()
    {
        $this->infoformats = array();
        $this->styles = array();
        $this->resourceUrl = array();
        $this->tilematrixSetlinks = array();
        $this->boundingBoxes = array();
    }

    /**
     * Set title
     *
     * @param string $title
     */
    public function setTitle($title)
    {
        $this->title = $title;
    }

    /**
     * Get title
     *
     * @return string $title
     */
    public function getTitle()
    {
        return $this->title;
    }

    /**
     * Set identifier
     *
     * @param string $identifier
     */
    public function setIdentifier($identifier)
    {
        $this->identifier = $identifier;
    }

    /**
     * Get identifier
     *
     * @return string $identifier
     */
    public function getIdentifier()
    {
        return $this->identifier;
    }

    /**
     * Set abstract
     *
     * @param string $abstract
     */
    public function setAbstract($abstract)
    {
        $this->abstract = $abstract;
    }

    /**
     * Get abstract
     *
     * @return string $abstract
     */
    public function getAbstract()
    {
        return $this->abstract;
    }

    /**
     * Set latlonBounds
     *
     * @param BoundingBox $latlonBounds
     * @return $this
     */
    public function setLatlonBounds(BoundingBox $latlonBounds = NULL)
    {
        $this->latlonBounds = $latlonBounds;
        return $this;
    }

    /**
     * Get latlonBounds
     *
     * @return BoundingBox
     */
    public function getLatlonBounds()
    {
        return $this->latlonBounds;
    }

    /**
     * Add boundingBox
     *
     * @param BoundingBox $boundingBoxes
     * @return $this
     */
    public function addBoundingBox(BoundingBox $boundingBoxes)
    {
        $this->boundingBoxes[] = $boundingBoxes;
        return $this;
    }

    /**
     * Set boundingBoxes
     *
     * @param array $boundingBoxes
     * @return $this
     */
    public function setBoundingBoxes($boundingBoxes)
    {
        $this->boundingBoxes = $boundingBoxes ? $boundingBoxes : array();
        return $this;
    }

    /**
     * Get boundingBoxes
     *
     * @return BoundingBox[]
     */
    public function getBoundingBoxes()
    {
        return $this->boundingBoxes;
    }

    /**
     * Set styles
     * @param array $styles
     * @return $this
     */
    public function setStyles($styles)
    {
        $this->styles = $styles;
        return $this;
    }

    /**
     * Add style
     * @param Style $style
     * @return $this
     */
    public function addStyle($style)
    {
        $this->styles[] = $style;
        return $this;
    }

    /**
     * Get styles
     *
     * @return Style[]
     */
    public function getStyles()
    {
        return $this->styles;
    }


    /**
     * Set infoformats
     *
     * @param array $infoformats
     * @return $this
     */
    public function setInfoformats($infoformats)
    {
        $this->infoformats = $infoformats;
        return $this;
    }

    /**
     * Add infoformat
     *
     * @param string $infoformat
     * @return $this
     */
    public function addInfoformat($infoformat)
    {
        $this->infoformats[] = $infoformat;
        return $this;
    }

    /**
     * Get infoformats
     *
     * @return array
     */
    public function getInfoformats()
    {
        return $this->infoformats;
    }

    /**
     *Gets tilematrixSetlinks.
     * @return TileMatrixSetLink[]
     */
    public function getTilematrixSetlinks()
    {
        return $this->tilematrixSetlinks;
    }

    /**
     * Sets tilematrixSetlinks
     * @param TileMatrixSetLink[] $tilematrixSetlinks
     * @return $this
     */
    public function setTilematrixSetlinks(array $tilematrixSetlinks = array())
    {
        $this->tilematrixSetlinks = $tilematrixSetlinks;
        return $this;
    }

    /**
     * Adds TileMatrixSetLink.
     * @param TileMatrixSetLink $tilematrixSetlink
     * @return $this
     */
    public function addTilematrixSetlinks(TileMatrixSetLink $tilematrixSetlink)
    {
        $this->tilematrixSetlinks[] = $tilematrixSetlink;
        return $this;
    }

    /**
     * Set resourceUrl
     * @param UrlTemplateType[] $resourceUrls
     * @return $this
     */
    public function setResourceUrl(array $resourceUrls = array())
    {
        $this->resourceUrl = $resourceUrls;
        return $this;
    }

    /**
     * Add resourceUrl
     * @param UrlTemplateType $resourceUrl
     * @return $this
     */
    public function addResourceUrl(UrlTemplateType $resourceUrl)
    {
        $this->resourceUrl[] = $resourceUrl;
        return $this;
    }

    /**
     * Get resourceUrl
     *
     * @return UrlTemplateType[]
     */
    public function getResourceUrl()
    {
        return $this->resourceUrl;
    }

    /**
     * Returns a merged array of the latlon bounds (if set) and other bounding boxes.
     * This is used by the *EntityHandler machinery frontend config generation.
     *
     * @return BoundingBox[]
     */
    public function getMergedBoundingBoxes()
    {
        $bboxes = array();
        $latLonBounds = $this->getLatlonBounds();
        if ($latLonBounds) {
            $bboxes[] = $latLonBounds;
        }
        return array_merge($bboxes, $this->getBoundingBoxes());
    }

    /**
     * @return string[]
     */
    public function getUniqueTileFormats()
    {
        $formats = array();
        foreach ($this->getResourceUrl() as $resourceUrl) {
            $resourceType = $resourceUrl->getResourceType() ?: 'tile';
            if ($resourceType === 'tile') {
                $formats[] = $resourceUrl->getFormat();
            }
        }
        return array_unique($formats);
    }

    public function mutateUrls(OneWayTransformer $transformer)
    {
        $newResourceUrls = array();
        foreach ($this->getResourceUrl() as $resourceUrl) {
            $resourceUrl->mutateUrls($transformer);
            $newResourceUrls[] = clone $resourceUrl;
        }
        $this->setResourceUrl($newResourceUrls);
    }
}
