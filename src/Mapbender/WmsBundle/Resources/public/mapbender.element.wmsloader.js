(function($){

    $.widget("mapbender.mbWmsloader", {
        options: {
            autoOpen: false,
            title: Mapbender.trans('mb.wms.wmsloader.title'),
            wms_url: null
        },
        loadedSourcesCount: 0,
        elementUrl: null,
        mbMap: null,
        _layerOptionsOn: {options: {treeOptions: {selected: true}}},
        _layerOptionsOff: {options: {treeOptions: {selected: false}}},
        _create: function() {
            var self = this;
            if(!Mapbender.checkTarget("mbWmsloader", this.options.target)){
                return;
            }
            Mapbender.elementRegistry.waitReady(this.options.target).then(function(mbMap) {
                self.mbMap = mbMap;
                self._setup();
                self._trigger('ready');
            });
        },
        _setup: function(){
            this.elementUrl = Mapbender.configuration.application.urls.element + '/' + this.element.attr('id') + '/';
            this.element.hide();
            var queryParams = Mapbender.Util.getUrlQueryParams(window.location.href);
            Mapbender.declarative = Mapbender.declarative || {};
            Mapbender.declarative['source.add.wms'] = $.proxy(this.loadDeclarativeWms, this);
            if (queryParams.wms_url) {
                // Fold top-level "VERSION=" and "SERVICE=" onto url (case insensitive)
                var wmsUrl = this._fixWmsUrl(queryParams.wms_url, queryParams);
                this.loadWms(wmsUrl);
            }

            if (queryParams.wms_id) {
                this._getInstances(queryParams.wms_id);
            }
            if (this.options.autoOpen) {
                this.open();
            }
        },
        defaultAction: function(callback){
            this.open(callback);
        },
        open: function(callback){
            this.callback = callback ? callback : null;
            var self = this;
            if(!this.popup || !this.popup.$element){
                this.element.show();
                this.popup = new Mapbender.Popup2({
                    title: self.element.attr('title'),
                    draggable: true,
                    modal: false,
                    closeOnESC: false,
                    content: self.element,
                    destroyOnClose: true,
                    width: 500,
                    height: 325,
                    buttons: {
                        'cancel': {
                            label: Mapbender.trans('mb.actions.cancel'),
                            cssClass: 'button buttonCancel critical right',
                            callback: function(){
                                self.close();
                            }
                        },
                        'ok': {
                            label: Mapbender.trans('mb.actions.add'),
                            cssClass: 'button right',
                            callback: function(){
                                var url = $('input[name="loadWmsUrl"]', self.element).val();
                                if(url === ''){
                                    $('input[name="loadWmsUrl"]', self.element).focus();
                                    return false;
                                }
                                var urlObj = new Mapbender.Util.Url(url);
                                urlObj.username = $('input[name="loadWmsUser"]', self.element).val();
                                urlObj.password = $('input[name="loadWmsPass"]', self.element).val();
                                self.loadWms(urlObj.asString());
                                self.element.hide().appendTo($('body'));
                                self.close();
                            }
                        }
                    }
                });
                this.popup.$element.on('close', $.proxy(this.close, this));
            }else{
                this.popup.open();
            }
        },
        close: function(){
            if(this.popup){
                this.element.hide().appendTo($('body'));
                if(this.popup.$element)
                    this.popup.destroy();
                this.popup = null;
            }
            if (this.callback) {
                (this.callback)();
                this.callback = null;
            }
        },
        loadDeclarativeWms: function(elm){
            var layerNamesToActivate = (elm.attr('mb-wms-layers') && elm.attr('mb-wms-layers').split(',')) || [];
            var mergeSource = !elm.attr('mb-wms-merge') || elm.attr('mb-wms-merge') === '1';
            var sourceUrl = elm.attr('mb-url') || elm.attr('href');

            if (mergeSource && this.mergeDeclarative(elm, sourceUrl, layerNamesToActivate)) {
                // Merged successfully to existing source, we're done
                return false;
            }
            // No merge allowed or merge allowed but no merge candidate found.
            // => load as an entirely new source
            this.loadWms(sourceUrl, {
                layers: layerNamesToActivate,
                // Default other layers (=not passed in via mb-wms-layers) to off, as per documentation
                keepOtherLayerStates: false
            });
            return false;
        },
        /**
         * @param {jQuery} $link
         * @param {string} sourceUrl
         * @param {Array<string>|false} layerNamesToActivate
         * @return {boolean} to indicate if a merge target was found and processed
         */
        mergeDeclarative: function($link, sourceUrl, layerNamesToActivate) {
            // NOTE: The evaluated attribute name has always been 'mb-wms-layer-merge', but documenented name
            //       was 'mb-layer-merge'. Just support both equivalently.
            var mergeLayersAttribValue = $link.attr('mb-wms-layer-merge') || $link.attr('mb-layer-merge');
            var keepCurrentActive = !mergeLayersAttribValue || (mergeLayersAttribValue === '1');
            var mergeCandidate = this._findMergeCandidateByUrl(sourceUrl);
            if (mergeCandidate) {
                this.activateLayersByName(mergeCandidate, layerNamesToActivate, keepCurrentActive);
                // NOTE: With no explicit layers to modify via mb-wms-layers, none of the other
                //       attributes and config params matter. We leave the source alone completely.
                return true;    // indicate merge target found, merging performed
            }
            return false;       // indicate no merge target, no merging performed
        },
        /**
         * @param {String} url
         * @param {Object} [options]
         * @property {Array<String>} [options.layers]
         * @property {boolean} [options.keepOtherLayerStates]
         */
        loadWms: function (url, options) {
            var self = this;
            $.ajax({
                url: self.elementUrl + 'loadWms',
                data: {
                    url: url
                },
                dataType: 'json',
                success: function(data, textStatus, jqXHR){
                    self._addSources(data, options || {});
                },
                error: function(jqXHR, textStatus, errorThrown){
                    self._getCapabilitiesUrlError(jqXHR, textStatus, errorThrown);
                }
            });
        },
        _getInstances: function(scvIds) {
            var self = this;
            $.ajax({
                url: self.elementUrl + 'getInstances',
                data: {
                    instances: scvIds
                },
                type: 'POST',
                dataType: 'json',
                success: function(response) {
                    (response.success || []).map(function(sourceDef) {
                        if (!self.mbMap.model.getSourceById(sourceDef.id)) {
                            self.mbMap.model.addSourceFromConfig(sourceDef);
                        }
                    });
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    Mapbender.error(Mapbender.trans('mb.wms.wmsloader.error.load'));
                }
            });
        },
        /**
         * @param {Array<Object>} sourceDefs
         * @param {Object} options
         * @property {Array<String>} [options.layers]
         * @property {boolean} [options.keepOtherLayerStates]
         */
        _addSources: function(sourceDefs, options) {
            var keepStates = options.keepOtherLayerStates || (typeof (options.keepOtherLayerStates) === 'undefined');
            var srcIdPrefix = 'wmsloader-' + $(this.element).attr('id');
            for (var i = 0; i < sourceDefs.length; ++i) {
                var sourceDef = sourceDefs[i];
                var sourceId = srcIdPrefix + '-' + (this.loadedSourcesCount++);
                sourceDef.id = sourceId;
                // Need to pre-generate layer ids now because layertree visual updates need layer ids
                Mapbender.Util.SourceTree.generateLayerIds(sourceDef);
                sourceDef.wmsloader = true;
                this.activateLayersByName(sourceDef, options.layers || [], keepStates);

                this.mbMap.model.addSourceFromConfig(sourceDef);
            }
        },
        /**
         * Locates an already loaded source with an equivalent base url, returns that source object or null
         * if no source matched.
         *
         * @param {string} url
         * @returns {Object|null}
         * @private
         */
        _findMergeCandidateByUrl: function(url) {
            var normalizeUrl = function(url) {
                var strippedUrl = Mapbender.Util.removeSignature(Mapbender.Util.removeProxy(url)).toLowerCase();
                // normalize query parameter encoding
                return new Mapbender.Util.Url(strippedUrl).asString();
            };
            var normUrl = normalizeUrl(url);
            var matches = this.mbMap.model.getSources().filter(function(source) {
                if (!source.configuration.options.url) {
                    // no static url (e.g. WMTS instance) => cannot process further
                    return false;
                }
                var sourceNormUrl = normalizeUrl(source.configuration.options.url);
                return sourceNormUrl.indexOf(normUrl) === 0 || normUrl.indexOf(sourceNormUrl) === 0;
            });
            return matches[0] || null;
        },
        activateLayersByName: function(source, names, keepCurrentActive) {
            var activateAll = names.indexOf('_all') !== -1;
            var matchedNames = [];
            if (!keepCurrentActive && !activateAll) {
                // Deactivate all non-root layers before activating only the required ones
                Mapbender.Util.SourceTree.iterateLayers(source, false, function(layer, offset, parents) {
                    var isRootLayer = !parents.length;
                    if (!isRootLayer) {
                        layer.options.treeOptions.selected = false;
                    }
                });
            }
            // always activate root layer
            var rootLayer = source.configuration.children[0];
            rootLayer.options.treeOptions.selected = rootLayer.options.treeOptions.allow.selected;
            Mapbender.Util.SourceTree.iterateSourceLeaves(source, false, function(layer, offset, parents) {
                var doActivate = activateAll;
                if (names.indexOf(layer.options.name) !== -1) {
                    matchedNames.push(layer.options.name);
                    doActivate = true;
                }
                if (doActivate) {
                    layer.options.treeOptions.selected = layer.options.treeOptions.allow.selected;
                    layer.options.treeOptions.info = layer.options.treeOptions.allow.info;
                    // also activate parent layers
                    for (var p = 0; p < parents.length; ++p) {
                        parents[p].options.treeOptions.selected = layer.options.treeOptions.allow.selected;
                    }
                }
            });
            if (!activateAll && matchedNames.length !== names.length) {
                console.warn("Declarative merge didn't find all layer names requested for activation", names, matchedNames);
            }
        },
        _fixWmsUrl: function(baseUrl, defaultParams) {
            var extraParams = {};
            var extraParamNames = ['VERSION', 'SERVICE', 'REQUEST'];
            var existingParams = Mapbender.Util.getUrlQueryParams(baseUrl);
            var existingParamNames = Object.keys(existingParams).map(function(name) {
                return name.toUpperCase();
            });
            Object.keys(defaultParams).forEach(function(prop) {
                var ucName = prop.toUpperCase();
                if (-1 !== extraParamNames.indexOf(ucName) && -1 === existingParamNames.indexOf(ucName)) {
                    extraParams[ucName] = defaultParams[prop];
                }
            });
            return Mapbender.Util.replaceUrlParams(baseUrl, extraParams, true);
        },
        _getCapabilitiesUrlError: function(xml, textStatus, jqXHR){
            Mapbender.error(Mapbender.trans('mb.wms.wmsloader.error.load'));
        },
        _destroy: $.noop
    });

})(jQuery);
