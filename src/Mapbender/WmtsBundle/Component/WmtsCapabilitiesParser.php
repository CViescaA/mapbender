<?php

namespace Mapbender\WmtsBundle\Component;

use Mapbender\CoreBundle\Component\Exception\XmlParseException;
use Mapbender\CoreBundle\Component\Exception\NotSupportedVersionException;
use Mapbender\WmtsBundle\Component\Exception\NoWmtsDocument;
use Mapbender\WmtsBundle\Component\Exception\WmtsException;

/**
 * Parses WMTS GetCapabilities documents
 *
 * @author Paul Schmidt
 */
abstract class WmtsCapabilitiesParser extends AbstractTileServiceParser
{
    /**
     * The XML representation of the Capabilites Document
     * @var \DOMDocument
     */
    protected $doc;

    /**
     * Creates an instance
     *
     * @param \DOMDocument $doc
     */
    public function __construct(\DOMDocument $doc)
    {
        parent::__construct(new \DOMXPath($doc));
        $this->doc = $doc;
        $this->xpath->registerNamespace("xlink", "http://www.w3.org/1999/xlink");
    }

    /**
     * Parses the capabilities document
     * @return \Mapbender\WmtsBundle\Entity\WmtsSource
     */
    abstract public function parse();

    /**
     * Creates a document
     *
     * @param string $data the string containing the XML
     * @return \DOMDocument a GetCapabilites document
     * @throws XmlParseException if a GetCapabilities xml is not valid
     * @throws WmtsException if an service exception
     * @throws NotSupportedVersionException if a service version is not supported
     * @throws NoWmtsDocument
     */
    public static function createDocument($data)
    {
        $doc = new \DOMDocument();
        if (!@$doc->loadXML($data)) {
            throw new XmlParseException("mb.wmts.repository.parser.couldnotparse");
        }
        // substitute xincludes
        $doc->xinclude();
        $rootTag = $doc->documentElement;
        $rootTagName = $rootTag->tagName;
        if (is_integer(strpos($rootTagName, "Exception"))) {
            $message = $rootTag->nodeValue;
            throw new WmtsException($message);
        } elseif (is_integer(strpos($rootTagName, "TileMapService"))) {
            throw new NoWmtsDocument("TileMapService");
        }

        if ($rootTagName !== "Capabilities") {
            throw new NotSupportedVersionException("mb.wmts.repository.parser.not_supported_document");
        }

        $version = $rootTag->getAttribute("version");
        if ($version !== "1.0.0") {
            throw new NotSupportedVersionException('mb.wmts.repository.parser.not_supported_version');
        }
        return $doc;
    }

    /**
     * Gets a capabilities parser
     *
     * @param \DOMDocument $doc the GetCapabilities document
     * @return static
     * @throws NotSupportedVersionException if a service version is not supported
     */
    public static function getParser(\DOMDocument $doc)
    {
        $version = $doc->documentElement->getAttribute("version");
        switch ($version) {
            case "1.0.0":
                return new WmtsCapabilitiesParser100($doc);
            default:
                throw new NotSupportedVersionException('mb.wmts.repository.parser.not_supported_version');
        }
    }
}
