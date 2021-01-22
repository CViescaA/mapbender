(function ($) {
    $.widget("mapbender.mbDimensionsHandler", {
        options: {
            dimensionsets: {}
        },
        model: null,
        _create: function () {
            var self = this;
            Mapbender.elementRegistry.waitReady(this.options.target).then(function(mbMap) {
                self._setup(mbMap);
            }, function() {
                Mapbender.checkTarget("mbDimensionsHandler", self.options.target);
            });
        },
        _setup: function (mbMap) {
            this.model = mbMap.getModel();
            var dimensionUuids = Object.keys(this.options.dimensionsets);
            for (var i = 0; i < dimensionUuids.length; ++i) {
                var key = dimensionUuids[i];
                var groupConfig = this.options.dimensionsets[dimensionUuids[i]];
                var sourceIds = (groupConfig.group || []).map(function(compoundId) {
                    return compoundId.replace(/-.*$/, '');
                });
                this._preconfigureSources(sourceIds, groupConfig.dimension);
                this._setupGroup(key, groupConfig);
            }
            this._trigger('ready');
        },
        _setupGroup: function(key, groupConfig) {
            var self = this;
            var dimension = Mapbender.Dimension(groupConfig['dimension']);
            var valarea = $('#' + key + ' .dimensionset-value', this.element);
            valarea.text(dimension.getDefault());
            $('#' + key + ' .mb-slider', this.element).slider({
                min: 0,
                max: dimension.getStepsNum(),
                value: dimension.getStep(dimension.getDefault()),
                slide: function (event, ui) {
                    valarea.text(dimension.valueFromStep(ui.value));
                },
                stop: function (event, ui) {
                    $.each(groupConfig.group, function (idx, item) {
                        var source = self.model.getSourceById(item.split('-')[0]);
                        if (source) {
                            var params = {};
                            params[dimension.getOptions().__name] = dimension.valueFromStep(ui.value);
                            source.addParams(params);
                        }
                    });
                }
            });
        },
        _preconfigureSources: function(sourceIds, dimensionConfig) {
            for (var i = 0; i < sourceIds.length; ++i) {
                var source = this.model.getSourceById(sourceIds[i]);
                this._preconfigureSource(source, dimensionConfig);
            }
        },
        _preconfigureSource: function(source, dimensionConfig) {
            var sourceDimensions = source && source.configuration.options.dimensions || [];
            for (var i = 0; i < sourceDimensions.length; ++i) {
                var sourceDimension = sourceDimensions[i];
                if (sourceDimension.name === dimensionConfig.name) {
                    sourceDimension.extent = dimensionConfig.extent;
                    sourceDimension.default = dimensionConfig.default;
                    // apply params
                    var params = {};
                    params[sourceDimension.__name] = dimensionConfig.default;
                    try {
                        source.addParams(params);
                    } catch (e) {
                        // Source is not yet an object, but we made our config changes => error is safe to ignore
                    }
                    // Can't have multiple dimension with the same parameter name
                    break;
                }
            }
        },
        _destroy: $.noop
    });
})(jQuery);
