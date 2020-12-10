window.Mapbender = Mapbender || {};
window.Mapbender.MapModelBase = (function() {
    /**
     * @typedef {Object} mmFlexibleExtent
     * @property {number} left
     * @property {number} right
     * @property {number} bottom
     * @property {number} top
     */
    /**
     * @typedef {Object} mmClickData
     * @property {Array<number>} pixel
     * @property {Array<number>} coordinate
     * @property {*} event
     */
    /**
     * @typedef {Object} mmDimension
     * @property {Number} width
     * @propery {Number} height
     */
    /**
     * @typedef {Object} mmViewParams
     * @property {String} srsName
     * @property {Array<Number>} center
     * @property {Number} scale
     * @property {Number} rotation
     */
    /**
     * @param {Object} mbMap
     * @constructor
     */
    function MapModelBase(mbMap) {
        Mapbender.mapEngine.patchGlobals(mbMap.options);
        Mapbender.Projection.extendSrsDefintions(mbMap.options.srsDefs || []);
        this.mbMap = mbMap;
        var mapOptions = mbMap.options;
        this.sourceTree = [];
        this._configProj = mapOptions.srs;
        var startProj = this._startProj = this._getInitialSrsCode(mapOptions);
        this.mapMaxExtent = Mapbender.mapEngine.boundsFromArray(mapOptions.extents.max);
        var startExtentArray;
        if (mapOptions.extra && mapOptions.extra.bbox) {
            startExtentArray = mapOptions.extra.bbox;
        } else {
            startExtentArray = mapOptions.extents.start || mapOptions.extents.max;
        }
        var poiOptions = (mbMap.options.extra || {}).pois || [];
        this._poiOptions = poiOptions.map(function(poi) {
            return Object.assign({}, Mapbender.mapEngine.transformCoordinate({x: poi.x, y: poi.y}, poi.srs || startProj, startProj), {
                scale: poi.scale,
                label: poi.label
            });
        });
        this.mapStartExtent = Mapbender.mapEngine.boundsFromArray(startExtentArray);
        if (!this._startProj) {
            throw new Error("Can't initialize map without srs option");
        }
        if (!startExtentArray) {
            throw new Error("Can't initialize map without a start extent");
        }
        this._startShare();
    }

    MapModelBase.prototype = {
        constructor: MapModelBase,
        mbMap: null,
        sourceTree: [],
        mapStartExtent: null,
        mapMaxExtent: null,
        /** Backend-configured initial projection, used for start / max extents */
        _configProj: null,
        /** Actual initial projection, determined by a combination of several URL parameters */
        _startProj: null,
        /**
         * @param {boolean} [closest] round to nearest configured map scale (default true if omitted)
         * @return {number}
         * engine-agnostic
         */
        getCurrentScale: function(closest) {
            if (closest || (typeof closest === 'undefined')) {
                var zoom = this.getCurrentZoomLevel(true);
                var scales = this._getScales();
                return scales[zoom];
            } else {
                return this._getFractionalScale();
            }
        },
        /**
         * @param {boolean} [closest] round to nearest configured map scale (default true if omitted)
         * @returns {number}
         */
        getCurrentZoomLevel: function(closest) {
            var zoom = this._getFractionalZoomLevel();
            if (closest || (typeof closest === 'undefined')) {
                zoom = Math.max(0, Math.min(this._countScales() - 1, Math.round(zoom)));
            }
            return zoom;
        },
        /**
         * engine-agnostic
         */
        pickZoomForScale: function(targetScale, pickHigh) {
            // @todo: fractional zoom: use exact targetScale (TBD: method should not be called?)
            var scales = this._getScales();
            var scale = this._pickScale(scales, targetScale, pickHigh);
            return scales.indexOf(scale);
        },
        /**
         * BC convenience getter. Commonly used only to determine number of decimals for rounding
         * coordinates for display.
         *
         * @param {String} [srsName] defaults to current projection
         * @return {number}
         * engine-agnostic
         */
        getProjectionUnitsPerMeter: function(srsName) {
            return Mapbender.mapEngine.getProjectionUnitsPerMeter(srsName || this.getCurrentProjectionCode());
        },
        /**
         * @param {int} scale
         * @param {number} [dpi]
         * @param {String} [srsName] defaults to current projection
         * @return {number}
         * engine-agnostic
         */
        scaleToResolution: function (scale, dpi, srsName) {
            var upm = this.getProjectionUnitsPerMeter(srsName);
            var inchesPerMetre = 39.37;
            return (scale * upm) / (inchesPerMetre * (dpi || this.mbMap.options.dpi || 72));
        },

        /**
         * @param {number} resolution
         * @param {number} [dpi=72]
         * @param {String} [srsName] defaults to current projection
         * @returns {number}
         * engine-agnostic
         */
        resolutionToScale: function(resolution, dpi, srsName) {
            var upm = this.getProjectionUnitsPerMeter(srsName);
            var inchesPerMetre = 39.37;
            return resolution * inchesPerMetre * (dpi || this.mbMap.options.dpi || 72) / upm;
        },
        /**
         * @return {Array<Object>}
         * engine-agnostic
         */
        getZoomLevels: function() {
            return this._getScales().map(function(scale, index) {
                return {
                    scale: scale,
                    level: index
                };
            });
        },
        /**
         * Activate / deactivate a single layer's selection and / or FeatureInfo state states.
         *
         * @param {Mapbender.SourceLayer} layer
         * @param {boolean|null} [selected]
         * @param {boolean|null} [info]
         * engine-agnostic
         */
        controlLayer: function controlLayer(layer, selected, info) {
            var updated = false;
            if (layer && selected !== null && typeof selected !== 'undefined') {
                var selected0 = layer.options.treeOptions.selected;
                var selectedAfter = !!selected && layer.options.treeOptions.allow.selected;
                updated = updated || (selected0 !== selectedAfter);
                layer.options.treeOptions.selected = selectedAfter;
            }
            if (layer && info !== null && typeof info !== 'undefined') {
                var info0 = layer.options.treeOptions.info;
                var infoAfter = !!info && layer.options.treeOptions.allow.info;
                updated = updated || (info0 !== infoAfter);
                layer.options.treeOptions.info = infoAfter;
            }
            if (updated) {
                this.updateSource(layer.source);
            }
        },
        /**
         * Updates the source identified by given id with a new layer order.
         * This will pull styles and "state" (such as visibility) from values
         * currently stored in the "geosource".
         *
         * @param {string} sourceId
         * @param {string[]} newLayerIdOrder
         * engine-agnostic
         */
        setSourceLayerOrder: function(sourceId, newLayerIdOrder) {
            var source = this.getSourceById(sourceId);
            Mapbender.Geo.SourceHandler.setLayerOrder(source, newLayerIdOrder);
            this._checkSource(source, false);
            // @todo: rename this event; it's about layers within a source
            $(this.mbMap.element).trigger('mbmapsourcemoved', {
                mbMap: this.mbMap,
                source: source
            });
        },
        /**
         * Zooms to layer
         * @param {Object} options
         * @property {String} options.sourceId
         * @property {String} options.layerId
         */
        zoomToLayer: function(options) {
            var source = this.getSourceById(options.sourceId);
            var bounds = source && source.getLayerBounds(options.layerId, this.getCurrentProjectionCode(), true, true);
            if (bounds) {
                this.setExtent(bounds);
            }
        },
        /**
         * @param {Number|String} id
         * @return {Mapbender.Source|null}
         * engine-agnostic
         */
        getSourceById: function(id) {
            return _.findWhere(this.sourceTree, {id: '' + id}) || null;
        },
        /**
         * @param {Mapbender.Layerset} theme
         * @param {Boolean} state
         */
        controlTheme: function(theme, state) {
            theme.selected = state;
            var instances = theme.children;
            for (var i = 0; i < instances.length; ++i) {
                var instance = instances[i];
                this.updateSource(instance);
            }
        },
        /**
         * @param {Mapbender.Source} source
         * @param {boolean} state
         * engine-agnostic
         */
        setSourceVisibility: function(source, state) {
            this.controlLayer(source.getRootLayer(), state);
        },
        /**
         * Reevaluates source's treeOptions and other settings and reapplies effective parameters.
         * This should be used if a sources internal configuration structure has been updated "manually".
         *
         * @param {Object} source
         */
        updateSource: function(source) {
            this._checkSource(source, false);
            $(this.mbMap.element).trigger('mbmapsourcechanged', {
                mbMap: this.mbMap,
                source: source
            });
        },
        /**
         * @return {Array<Mapbender.Source>}
         * engine-agnostic
         */
        getSources: function() {
            return this.sourceTree;
        },
        /**
         * @param {string} [srsName] default: current
         * @return {mmFlexibleExtent}
         */
        getCurrentExtent: function(srsName) {
            var srsNow = this.getCurrentProjectionCode();
            var srsName_ = srsName || srsNow;
            var extentArray = this.getCurrentExtentArray();
            var extentNative = Mapbender.mapEngine.boundsFromArray(extentArray);
            return Mapbender.mapEngine.transformBounds(extentNative, srsNow, srsName_);
        },
        /**
         * @param {string} [srsName] default: current
         * @return {mmFlexibleExtent}
         */
        getMaxExtent: function(srsName) {
            var srsName_ = srsName || this.getCurrentProjectionCode();
            return Mapbender.mapEngine.transformBounds(this.mapMaxExtent, this._configProj, srsName_);
        },
        /**
         * @param {string} [srsName] default: current
         * @return {Array<Number>}
         */
        getMaxExtentArray: function(srsName) {
            var x = this.getMaxExtent(srsName);
            return [x.left, x.bottom, x.right, x.top];
        },
        getPointFeatureInfoUrl: function(source, x, y, maxCount) {
            var layerNames = source.getFeatureInfoLayers().map(function(layer) {
                return layer.options.name;
            });
            var engine = Mapbender.mapEngine;
            var olLayer = source.getNativeLayer(0);
            if (!(layerNames.length && olLayer && engine.getLayerVisibility(olLayer))) {
                return false;
            }
            var params = $.extend({}, source.customParams || {}, {
                QUERY_LAYERS: layerNames.join(','),
                STYLES: (Array(layerNames.length)).join(','),
                INFO_FORMAT: source.configuration.options.info_format || 'text/html',
                EXCEPTIONS: source.configuration.options.exception_format,
                FEATURE_COUNT: maxCount || 100
            });
            params.LAYERS = params.QUERY_LAYERS;
            return engine.getPointFeatureInfoUrl(this.olMap, source, x, y, params);
        },
        /**
         *
         * @param scales
         * @param targetScale
         * @param pickHigh
         * @return {*}
         * @private
         * engine-agnostic
         */
        _pickScale: function(scales, targetScale, pickHigh) {
            if (targetScale >= scales[0]) {
                return scales[0];
            }
            for (var i = 0, nScales = scales.length; i < nScales - 1; ++i) {
                var scaleHigh = scales[i];
                var scaleLow = scales[i + 1];
                if (targetScale <= scaleHigh && targetScale >= scaleLow) {
                    if (targetScale > scaleLow && pickHigh) {
                        return scaleHigh;
                    } else {
                        return scaleLow;
                    }
                }
            }
            return scales[nScales - 1];
        },
        /**
         * engine-agnostic
         */
        _getMaxZoomLevel: function() {
            // @todo: fractional zoom: no discrete scale steps
            return this._getScales().length - 1;
        },
        /**
         * engine-agnostic
         */
        _clampZoomLevel: function(zoomIn) {
            return Math.max(0, Math.min(zoomIn, this._getMaxZoomLevel()));
        },
        /**
         * Calculates and applies layer state changes from accumulated treeOption changes in the source and (optionally)
         * 1) updates the engine layer parameters and redraws
         * 2) fires a mbmapsourcechanged event
         * @param {Object} source
         * @param {boolean} fireSourceChangedEvent
         */
        _checkSource: function(source, fireSourceChangedEvent) {
            var scale = this.getCurrentScale();
            var extent = this.getCurrentExtent();
            var srsName = this.getCurrentProjectionCode();
            var changedStates = Mapbender.Geo.SourceHandler.updateLayerStates(source, scale, extent, srsName);
            source.updateEngine();
            if (fireSourceChangedEvent && changedStates) {
                $(this.mbMap.element).trigger('mbmapsourcechanged', {
                    mbMap: this.mbMap,
                    source: source
                });
            }
        },
        /**
         * @return {Array<String>}
         * @static
         */
        getHandledUrlParams: function() {
            return ['visiblelayers', 'scale', 'center', 'srs'];
        },
        processUrlParams: function() {
            var visibleLayersParam = new Mapbender.Util.Url(window.location.href).getParameter('visiblelayers');
            if (visibleLayersParam) {
                this.processVisibleLayersParam(visibleLayersParam);
            }
        },
        /**
         * Activate specific layers on specific sources by interpreting a (comma-separated list of)
         * "<sourceId>/<layerId>" parameter pair.
         * The indicated source and layer must already be part of the running configuration for this
         * to work.
         *
         * @param {string} paramValue
         */
        processVisibleLayersParam: function(paramValue) {
            var self = this;
            var specs = (paramValue || '').split(',');
            $.each(specs, function(idx, layerSpec) {
                var idParts = layerSpec.split('/');
                if (idParts.length >= 2) {
                    var sourceId = idParts[0];
                    var layerId = idParts[1];
                    console.log("Activating", sourceId, layerId);
                    var source = self.getSourceById(sourceId);
                    var layer = source && source.getLayerById(layerId);
                    if (layer) {
                        layer.options.treeOptions.selected = true;
                        layer.options.treeOptions.info = layer.options.treeOptions.allow.info;
                        var parent = layer.parent;
                        while (parent) {
                            parent.options.treeOptions.selected = true;
                            parent = parent.parent;
                        }
                        self.updateSource(source);
                    }
                }
            });
        }
    };

    // Deprecated old-style APIs
    Object.assign(MapModelBase.prototype, {
        removeLayer: function(layer) {
            if (!layer.parent) {
                this.removeSource(layer.source);
            } else {
                var topMostRemovedLayerId = layer.remove();
                var rootLayerId = layer.source.getRootLayer().options.id;
                if (topMostRemovedLayerId === rootLayerId) {
                    this.removeSource(layer.source);
                } else {
                    this._checkSource(layer.source, false);
                    this.mbMap.element.trigger('mbmapsourcelayerremoved', {
                        layer: layer,
                        source: layer.source,
                        mbMap: this.mbMap
                    });
                }
            }
        },
        removeSource: function(source) {
            var stIndex = this.sourceTree.indexOf(source);
            Mapbender.mapEngine.removeLayers(this.olMap, source.nativeLayers);
            if (stIndex !== -1) {
                this.sourceTree.splice(stIndex, 1);
            }
            if (source.layerset) {
                source.layerset.removeChild(source);
            }
            $(this.mbMap.element).trigger('mbmapsourceremoved', {
                source: source
            });
        },
        /**
         * @param {OpenLayers.Layer.HTTPRequest|Object} source
         * @param {boolean} [initializePod] to auto-instantiate a Mapbender.Source object from plain-old-data (default true)
         * @param {boolean} [initializeLayers] to also auto-instantiate layers after instantiating Mapbender.Source (default false)
         * @return {Mapbender.Source}
         * @deprecated should work with Source class instances directly
         * engine-agnostic
         */
        getMbConfig: function(source, initializePod, initializeLayers) {
            var _s;
            var projCode;
            if (source.mbConfig) {
                // monkey-patched OpenLayers.Layer
                _s =  source.mbConfig;
            } else if (source.source) {
                // MapQuery layer
                _s = source.source;
            } else if (source.configuration && source.configuration.children) {
                _s = source;
            }
            if (_s) {
                if (initializePod || typeof initializePod === 'undefined') {
                    if (!(_s instanceof Mapbender.Source)) {
                        var sourceObj = Mapbender.Source.factory(_s);
                        if (initializeLayers) {
                            projCode = projCode || this.getCurrentProjectionCode();
                            sourceObj.initializeLayers(projCode);
                        }
                        return sourceObj;
                    }
                }
                return _s;
            }
            console.error("Cannot infer source configuration from given input", source);
            throw new Error("Cannot infer source configuration from given input");
        },
        initializeSourceLayers: function() {
            var self = this;
            // Array.protoype.reverse is in-place
            // see https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse
            // Do not use .reverse on centrally shared values without making your own copy
            $.each(this.mbMap.options.layersets.slice().reverse(), function(idx, layersetId) {
                var theme = Mapbender.layersets.filter(function(x) {
                    return x.id === layersetId || ('' + x.id === '' + layersetId);
                })[0];
                if (!theme) {
                    throw new Error("No layerset with id " + layersetId);
                }
                theme.children.slice().reverse().map(function(instance) {
                    self.addSource(instance);
                });
            });
        },
        /**
         * @param {Mapbender.Source} source
         */
        addSource: function(source) {
            this.sourceTree.push(source);
            var projCode = this.getCurrentProjectionCode();

            var olLayers = source.initializeLayers(projCode);
            for (var i = 0; i < olLayers.length; ++i) {
                var olLayer = olLayers[i];
                Mapbender.mapEngine.setLayerVisibility(olLayer, false);
            }

            this._spliceLayers(source, olLayers);
            this._checkSource(source, false);

            this.mbMap.element.trigger('mbmapsourceadded', {
                mbMap: this.mbMap,
                source: source
            });
        },
        /**
         * Creates a Mapbender.Source instance from given configuration, adds it,
         * and returns it.
         *
         * @param {Object} sourceDef
         * @returns {Mapbender.Source}
         */
        addSourceFromConfig: function(sourceDef) {
            var source = Mapbender.Source.factory(sourceDef);
            this.addSource(source);
            return source;
        },
        /**
         * Bring the sources identified by the given ids into the given order.
         * All other sources will be left alone!
         *
         * @param {string[]} newIdOrder
         */
        reorderSources: function(newIdOrder) {
            var self = this, olMap = this.olMap, engine = Mapbender.mapEngine;
            var i;

            // Collect current positions used by the layers to be reordered
            // position := array index in olMap.layers
            // The collected positions will be reused / redistributed to the affected
            // layers, while all other layers stay in their current slots.
            var layersToMove = [];
            var currentLayerArray = engine.getLayerArray(olMap);
            var oldIndexes = [];
            var olLayerIdsToMove = {};
            for (i = 0; i < newIdOrder.length; ++i) {
                var source = this.getSourceById(newIdOrder[i]);
                source && source.getNativeLayers().map(function(olLayer) {
                    layersToMove.push(olLayer);
                    oldIndexes.push(currentLayerArray.indexOf(olLayer));
                    var layerUid = engine.getUniqueLayerId(olLayer);
                    olLayerIdsToMove[layerUid] = true;
                });
            }
            oldIndexes.sort(function(a, b) {
                // sort numerically (default sort performs string comparison)
                return a - b;
            });

            var unmovedLayers = currentLayerArray.filter(function(olLayer) {
                var layerUid = engine.getUniqueLayerId(olLayer);
                return !olLayerIdsToMove[layerUid];
            });

            // rebuild the layer list, mixing in unmoving layers with reordered layers
            var newLayers = [];
            var unmovedIndex = 0;
            for (i = 0; i < oldIndexes.length; ++i) {
                var nextIndex = oldIndexes[i];
                while (nextIndex > newLayers.length) {
                    newLayers.push(unmovedLayers[unmovedIndex]);
                    ++unmovedIndex;
                }
                newLayers.push(layersToMove[i]);
            }
            while (unmovedIndex < unmovedLayers.length) {
                newLayers.push(unmovedLayers[unmovedIndex]);
                ++unmovedIndex;
            }
            // set new layer list, let OpenLayers reassign z indexes in list order
            engine.replaceLayers(olMap, newLayers);
            // Re-sort 'sourceTree' structure (inspected by legend etc for source order) according to actual, applied
            // layer order.
            this.sourceTree.sort(function(a, b) {
                var indexA = newLayers.indexOf(a.getNativeLayer(0));
                var indexB = newLayers.indexOf(b.getNativeLayer(0));
                return indexA - indexB;
            });
            this.mbMap.element.trigger('mbmapsourcesreordered', {
                mbMap: this.mbMap
            });
        },
        changeProjection: function(srsName) {
            var srsNameBefore = this.getCurrentProjectionCode();
            if (srsNameBefore === srsName) {
                return;
            }
            $(this.mbMap.element).trigger('mbmapbeforesrschange', {
                from: srsNameBefore,
                to: srsName,
                mbMap: this.mbMap
            });
            this._changeProjectionInternal(srsNameBefore, srsName);
            this.mbMap.element.trigger('mbmapsrschanged', {
                from: srsNameBefore,
                to: srsName,
                mbMap: this.mbMap
            });
            for (var i = 0; i < this.sourceTree.length; ++i) {
                var source = this.sourceTree[i];
                if (source.checkRecreateOnSrsSwitch(srsNameBefore, srsName)) {
                    // WMTS / TMS special: send another change event for each root layer, which
                    // may potentially just have been disabled / reenabled. This will update the
                    // Layertree visual
                    $(this.mbMap.element).trigger('mbmapsourcechanged', {
                        mbMap: this.mbMap,
                        source: source
                    });
                }
            }
        },
        /**
         * @param {number|null} targetZoom
         * @param {Object} scaleOptions
         * @param {number=} scaleOptions.minScale
         * @param {number=} scaleOptions.maxScale
         * @return {number|null}
         * @private
         */
        _adjustZoom: function(targetZoom, scaleOptions) {
            var zoom = targetZoom;
            var zoomNow = this.getCurrentZoomLevel();
            if (scaleOptions && scaleOptions.minScale) {
                var maxZoom = this.pickZoomForScale(scaleOptions.minScale, true);
                if (zoom !== null) {
                    zoom = Math.min(zoom, maxZoom);
                } else {
                    zoom = Math.min(zoomNow, maxZoom);
                }
            }
            if (scaleOptions && scaleOptions.maxScale) {
                var minZoom = this.pickZoomForScale(scaleOptions.maxScale, false);
                if (zoom !== null) {
                    zoom = Math.max(zoom, minZoom);
                } else {
                    zoom = Math.max(zoomNow, minZoom);
                }
            }
            return zoom;
        },
        /**
         * @return {mmDimension}
         */
        getCurrentViewportSize: function() {
            return Mapbender.mapEngine.getCurrentViewportSize(this.olMap);
        },
        displayPois: function(poiOptions) {
            if (!poiOptions.length) {
                return;
            }
            var layer = Mapbender.vectorLayerPool.getElementLayer(this, 0);
            layer.setBuiltinMarkerStyle('poiIcon');
            for (var i = 0; i < poiOptions.length; ++i) {
                this.displayPoi(layer, poiOptions[i]);
            }
        },
        displayPoi: function(layer, poi) {
            layer.addMarker(poi.x, poi.y);
            if (poi.label) {
                this.openPopup(poi.x, poi.y, poi.label);
            }
        },
        /**
         * @param {Number} x projected
         * @param {Number} y projected
         * @param {String|Element|jQuery} [content]
         * @return {Promise}
         */
        openPopup: function(x, y, content) {
            var contentNode = document.createElement('div');
            if (content) {
                if (typeof content === 'string') {
                    contentNode.innerText = content;
                } else {
                    $(content).appendTo(contentNode);
                }
            }
            return this.openPopupInternal_(x, y, contentNode);
        },
        /**
         * @return {mmViewParams}
         */
        getCurrentViewParams: function() {
            return {
                scale: this.getCurrentScale(false),
                center: this.getCurrentMapCenter(),
                srsName: this.getCurrentProjectionCode(),
                rotation: this.getViewRotation()
            };
        },
        /**
         * @param {mmViewParams} options
         */
        applyViewParams: function(options) {
            if (options.srsName) {
                this.changeProjection(options.srsName);
            }
            var centerOptions = {};
            var center = options.center;
            if (options.scale) {
                centerOptions.minScale = options.scale;
                centerOptions.maxScale = options.scale;
                center = options.center|| this.getCurrentMapCenter();
            }
            if (center) {
                // @todo: fix restore of fractional scale (currently snaps to a configured zoom level)
                this.centerXy(center[0], center[1], centerOptions);
            }
        },
        /**
         * @param {mmViewParams} params
         * @return {String}
         */
        encodeViewParams: function(params) {
            // @todo: resolve inconsistent data format getCurrentMapCenter (Array<number>) vs transformCoordinate ({x: number, y: number})
            var center0 = {
                x: params.center[0],
                y: params.center[1]
            };
            var center84 = Mapbender.mapEngine.transformCoordinate(center0, params.srsName, 'WGS84');
            var center = [center84.x, center84.y];

            // normalize center: keep positive, round to five digits (~meter resolution)
            for (var ci = 0; ci < 2; ++ci) {
                while (center[ci] < 0) center[ci] += 360;
                center[ci] = center[ci].toFixed(5);
            }
            // round scale to integer and stringify
            var scale = params.scale.toFixed(0);
            var parts = [
                scale,
                '@',
                center[0],
                '/',
                center[1],
                'r',
                parseInt(params.rotation),
                '@',
                params.srsName
            ];
            return parts.join('');
        },
        /**
         * @param {String} value
         * @return {mmViewParams}
         */
        decodeViewParams: function(value) {
            var parts = /^(\d+)@([\d.]+)\/([\d.]+)r(-?\d+)@(\w+:\d+)$/.exec(value). slice(1);
            console.log("Parts?", parts);
            // @todo: resolve inconsistent data format getCurrentMapCenter (Array<number>) vs transformCoordinate ({x: number, y: number})
            var center84 = {
                x: parseFloat(parts[1]),
                y: parseFloat(parts[2])
            };
            var targetSrsName = parts[4];
            var centerTargetSrs = Mapbender.mapEngine.transformCoordinate(center84, 'WGS84', targetSrsName);
            var params = {
                scale: parseInt(parts[0]),
                center: [centerTargetSrs.x, centerTargetSrs.y],
                rotation: parseInt(parts[3]) || 0,
                srsName: targetSrsName
            };
            return params;
        },
        /**
         * @param feature
         * @param {Model~BufferOptions} [options]
         * @return {*}
         * @private
         */
        _getBufferedFeatureBounds: function(feature, options) {
            var engine = Mapbender.mapEngine;
            var bounds = engine.getFeatureBounds(feature);
            var bufferAbs = (options || {}).buffer;
            var bufferFactor = (options || {}).ratio;
            if (typeof bufferAbs === 'undefined'){
                bufferAbs = 100;
            }
            if (typeof bufferFactor === 'undefined') {
                if (bufferAbs !== 0) {
                    bufferFactor = 1.5;
                } else {
                    bufferFactor = 1.0;
                }
            }

            if (bufferAbs) {
                var unitsPerMeter = engine.getProjectionUnitsPerMeter(this.getCurrentProjectionCode());
                var bufferNative = bufferAbs * unitsPerMeter;
                bounds.left -= bufferNative;
                bounds.right += bufferNative;
                bounds.top += bufferNative;
                bounds.bottom -= bufferNative;
            }
            if (bufferFactor) {
                var centerX = 0.5 * (bounds.left + bounds.right);
                var centerY = 0.5 * (bounds.top + bounds.bottom);
                bounds.left = centerX + bufferFactor * (bounds.left - centerX);
                bounds.right = centerX + bufferFactor * (bounds.right - centerX);
                bounds.top = centerY + bufferFactor * (bounds.top - centerY);
                bounds.bottom = centerY + bufferFactor * (bounds.bottom - centerY);
            }
            return bounds;
        },
        /**
         * @param {OpenLayers.Map|ol.PluggableMap} olMap
         * @param {Object} startExtent
         * @param {Object} mapOptions
         * @param {Number} mapOptions.dpi
         * @param {String} srsName
         * @return {number}
         * @private
         */
        _getInitialResolution: function(olMap, startExtent, mapOptions, srsName) {
            var urlParams = (new Mapbender.Util.Url(window.location.href)).parameters;
            var centerOverride = !!urlParams.center;
            var scaleOverride = parseInt(urlParams.scale);
            if (!scaleOverride && !centerOverride && this._poiOptions.length) {
                scaleOverride = parseInt(this._poiOptions[0].scale || '2500');
            }
            if (scaleOverride) {
                return this.scaleToResolution(scaleOverride, mapOptions.dpi, srsName);
            } else {
                var viewportSize = Mapbender.mapEngine.getCurrentViewportSize(olMap);
                return Math.max(
                    Math.abs(startExtent.right - startExtent.left) / viewportSize.width,
                    Math.abs(startExtent.top - startExtent.bottom) / viewportSize.height
                );
            }
        },
        /**
         * @param {Object} mapOptions
         * @param {Array<Number>} [mapOptions.center]
         * @param {Object} startExtent
         * @return {Array<Number>}
         * @private
         */
        _getInitialCenter: function(mapOptions, startExtent) {
            var urlParams = (new Mapbender.Util.Url(window.location.href)).parameters;
            var centerOverride = urlParams.center;
            centerOverride = (centerOverride || '').split(',').map(parseFloat).filter(function(x) {
                return !isNaN(x);
            });
            if (centerOverride.length === 2) {
                return centerOverride;
            } else if (this._poiOptions && this._poiOptions.length === 1) {
                var singlePoi = this._poiOptions[0];
                return [singlePoi.x, singlePoi.y];
            } else {
                return [
                    0.5 * (startExtent.left + startExtent.right),
                    0.5 * (startExtent.bottom + startExtent.top)
                ];
            }
        },
        /**
         * @param {Object} mapOptions
         * @param {String} mapOptions.srs
         * @param {Object} [mapOptions.extra]
         * @param {Array<Object>} [mapOptions.extra.pois]
         * @private
         */
        _getInitialSrsCode: function(mapOptions) {
            var urlParams = (new Mapbender.Util.Url(window.location.href)).parameters;
            var centerOverride = !!urlParams.center;
            var srsOverride = (urlParams.srs || '').toUpperCase();
            var pois = (mapOptions.extra || {}).pois || [];
            if (pois.length && !centerOverride && pois[0].srs) {
                srsOverride = pois[0].srs;
            }
            if (srsOverride) {
                if (!/^EPSG:\d+$/.test(srsOverride)) {
                    console.warn("Ingoring invalid srs code override; must use EPSG:<digits> form", srsOverride);
                    srsOverride = undefined;
                } else {
                    var matches = mapOptions.srsDefs.filter(function(srsDef) {
                        return srsDef.name === srsOverride;
                    });
                    if (!matches.length) {
                        console.warn("Ingoring srs code override not supported by map element configuration", srsOverride);
                        srsOverride = undefined;
                    }
                }
            }
            return srsOverride || mapOptions.srs;
        },
        /**
         * @param {mmViewParams} params
         * @private
         */
        _updateViewParamFragment: function(params) {
            var newHash = this.encodeViewParams(params);
            // NOTE: hash property getter will return a leading '#'. It doesn't matter if
            //       we include the '#' when setting a hash via location.hash or pushState / replaceState
            var currentHash = (window.location.hash || '').replace(/^#/, '');
            // avoid creating a browser history entry if params are equal
            if (currentHash !== newHash) {
                if (!currentHash) {
                    // Set first state WITHOUT creating a new navigation history entry
                    window.history.replaceState({}, '', '#' + newHash);
                } else {
                    window.history.pushState({}, '', '#' + newHash);
                }
            }
        },
        _applyViewParamFragment: function() {
            try {
                var params = this.decodeViewParams((window.location.hash || '').replace(/^#/, ''));
                this.applyViewParams(params);
            } catch (e) {
                // do absolutely nothing
            }
        },
        _startShare: function() {
            console.warn("_startShare");
            var self = this;
            var updateHandler = function(evt, data) {
                self._updateViewParamFragment(data.params);
            };
            this.mbMap.element.on('mbmapviewchanged', _.debounce(updateHandler, 400));
            window.addEventListener('hashchange', function() {
                self._applyViewParamFragment();
            });
        },
        _comma_dangle_dummy: null
    });

    return MapModelBase;
}());
