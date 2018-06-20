window.Mapbender = Mapbender || {};
window.Mapbender.Model = Mapbender.Model || {};
window.Mapbender.Model.Source = (function() {
    'use strict';

    /**
     * Instantiate a Mapbender.Model.Source from a given config + id and bind it to the given Mapbender.Model instance
     *
     * @param {Mapbender.Model} model
     * @param {object} config plain old data, generated server-side
     * @param {string} [id] defaults to auto-generated value; will be cast to string
     * @constructor
     */
    function Source(model, config, id) {
        this.model = model;
        this.id = "" + (id || model.generateSourceId());
        this.type = (config['type'] || 'wms').toLowerCase();
        this.baseUrl_ = config.configuration.options.url;
        this.options = {
            opacity: config.configuration.options['opacity'] || 1,
            tiled: false // configuration.options.tiled || false
        };
        this.urlSettingsFixed = {
            VERSION: config.configuration.options.version || "1.1.1",
            FORMAT: config.configuration.options.format || 'image/png',
            TRANSPARENT: (config.configuration.options.transparent || true) ? "TRUE" : "FALSE",
            INFO_FORMAT: config.configuration.options.info_format || 'text/html'
        };
        this.customRequestParams = {};

        var layerDefs = this.extractLeafLayerConfigs(config.configuration);
        this.layerOptionsMap_ = {};
        this.layerNameMap_ = {};
        this.allLayerNames_ = [];

        _.forEach(layerDefs, function(layerConfig) {
            this.processLayerConfig(layerConfig);
        }.bind(this));
    }

    /**
     * "Static" factory method.
     * @todo: different auto-selected classes for WMS vs WMTS?
     *
     * @param {Mapbender.Model} model
     * @param {object} config
     * @param {string} [id]
     * @returns {Source}
     */
    Source.fromConfig = function(model, config, id) {
        return new Source(model, config, id);
    };
    // convenience: make fromConfig accessible via instance as well
    Source.prototype.fromConfig = Source.fromConfig;

    /**
     * @param {ol.layer.Tile} engineLayer
     */
    Source.prototype.initializeEngineLayer = function initializeEngineLayer(engineLayer) {
        if (this.engineLayer_) {
            throw new Error("Source: engine layer already assigned, runtime changes not allowed");
        }
        this.engineLayer_ = engineLayer;
    };

    /**
     * Traverses the (historically) nested layer configuration array and returns *only*
     * the configs for the leaves as one flat list.
     *
     * @param {object} layerConfig nested configuration array
     * @return {object[]}
     *
     * @todo: Nested configuration is only needed for presentation (Layertree)
     *        => separate layertree configuration from Model configuration server-side
     */
    Source.prototype.extractLeafLayerConfigs = function(layerConfig) {
        if (layerConfig.children) {
            var childConfigs = [];
            _.forEach(layerConfig.children, function(childConfig) {
                childConfigs = childConfigs.concat(this.extractLeafLayerConfigs(childConfig));
            }.bind(this));
            return childConfigs;
        } else {
            return [layerConfig.options];
        }
    };

    /**
     * Inspects config for a single leaf layer and adds it to internal data structures.
     *
     * @param {object} layerConfig plain old data
     */
    Source.prototype.processLayerConfig = function(layerConfig) {
        if (!layerConfig.id) {
            console.error("Missing / empty 'id' in layer configuration", layerConfig);
            throw new Error("Can't initialize layer with empty id");
        }
        if (!layerConfig.name) {
            console.error("Missing / empty 'name' in layer configuration", layerConfig);
            throw new Error("Can't initialize layer with empty name");
        }
        var stringId = "" + layerConfig.id;
        var stringLayerName = "" + layerConfig.name;
        this.layerOptionsMap_[stringId] = layerConfig;
        this.layerNameMap_[stringLayerName] = layerConfig;
        this.allLayerNames_.push(stringLayerName);

        //HACK: all layers treated as (initially) active
        // @todo: scan "parent" nodes in configuration to determine enabled state
        // @todo: also initialize if layer is queryable
        var layerActive = true;

        if (layerActive) {
            if (!this.customRequestParams.LAYERS) {
                this.customRequestParams.LAYERS = stringLayerName;
            } else {
                this.customRequestParams.LAYERS = [this.customRequestParams.LAYERS, stringLayerName].join(',');
            }
        }
    };

    Source.prototype.updateEngine = function updateEngine() {
        var params = $.extend({}, this.urlSettingsFixed, this.customRequestParams);
        this.engineLayer_.setOpacity(this.options.opacity);
        this.engineLayer_.getSource().updateParams(params);
    };


    /**
     * @returns {string[]}
     */
    Source.prototype.getActiveLayerNames = function() {
        var effectiveQueryParams = this.engineLayer_.getSource().getParams();
        if (typeof effectiveQueryParams.LAYERS === 'undefined') {
            console.error("getParameters returned:", effectiveQueryParams);
            throw new Error("LAYERS parameter not populated");
        }
        return _.filter((effectiveQueryParams.LAYERS || "").split(','));
    };

    /**
     * @returns {string|null}
     */
    Source.prototype.getType = function() {
        return this.type;
    };
    /**
     * @returns {string}
     */
    Source.prototype.getBaseUrl = function() {
        return this.baseUrl_;
    };

    return Source;
})();
