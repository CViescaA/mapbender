(function($){

    $.widget("mapbender.mbSketch", $.mapbender.mbBaseElement, {
        options: {
            target: null,
            auto_activate: false,
            deactivate_on_close: true,
            geometrytypes: ['point', 'line', 'polygon', 'rectangle', 'text'],
            paintstyles: {
                'strokeColor': '#ff0000',
                'fillColor': '#ff0000',
                'strokeWidth': '3'
            }
        },
        mbMap: null,
        map: null,
        layer: null,
        geomCounter: 0,
        rowTemplate: null,
        toolLabels: {},
        requireText_: false,
        editing_: null,
        $labelInput_: null,
        useDialog_: false,

        _create: function() {
            Object.assign(this.toolLabels, {
                'point': Mapbender.trans('mb.core.sketch.geometrytype.point'),
                'line': Mapbender.trans('mb.core.sketch.geometrytype.line'),
                'polygon': Mapbender.trans('mb.core.sketch.geometrytype.polygon'),
                'rectangle': Mapbender.trans('mb.core.sketch.geometrytype.rectangle'),
                'circle': Mapbender.trans('mb.core.sketch.geometrytype.circle'),
                'text': Mapbender.trans('mb.core.sketch.geometrytype.text')
            });
            this.useDialog_ = !this.element.closest('.sideContent').length && !this.element.closest('.mobilePane').length;
            this.$labelInput_ = $('input[name="label-text"]', this.element);
            var self = this;
            Mapbender.elementRegistry.waitReady(this.options.target).then(function(mbMap) {
                self.mbMap = mbMap;
                self._setup();
            }, function() {
                Mapbender.checkTarget("mbSketch", self.options.target);
            });
        },
        _setup: function(){
            var $geomTable = $('.geometry-table', this.element);
            // @todo: remove direct access to OpenLayers 2 map
            this.map = this.mbMap.map.olMap;
            this.rowTemplate = $('tr', $geomTable).remove();
            $geomTable.on('click', '.geometry-remove', $.proxy(this._removeFromGeomList, this));
            $geomTable.on('click', '.geometry-edit', $.proxy(this._modifyFeature, this));
            $geomTable.on('click', '.geometry-zoom', $.proxy(this._zoomToFeature, this));
            var self = this;
            $('[data-tool-name]', this.element).on('click', function() {
                return self._onToolButtonClick($(this));
            });
            $('.-fn-tool-off', this.element).on('click', function() {
                self._deactivateControl();
                $(this).prop('disabled', true);
            });

            this.layer = Mapbender.vectorLayerPool.getElementLayer(this, 0);
            this.layer.customizeStyle(Object.assign({}, this.options.paintstyles, {
                label: function(feature) {
                    return self._getFeatureAttribute(feature, 'label') || '';
                },
                labelAlign: function(feature) {
                    if (-1 !== ['point', 'text'].indexOf(self._getFeatureAttribute(feature, 'toolName'))) {
                        return 'lm';
                    } else {
                        return 'cm';
                    }
                },
                labelXOffset: function(feature) {
                    if (-1 !== ['point', 'text'].indexOf(self._getFeatureAttribute(feature, 'toolName'))) {
                        return 10;
                    } else {
                        return 0;
                    }
                }
            }));

            if (Mapbender.mapEngine.code === 'ol2') {
                // OpenLayers 2: keep reusing single edit control
                this.editControl = this._createEditControl(this.layer.getNativeLayer());
                // Native "sketchcomplete" event is OpenLayers 2 only
                this.layer.getNativeLayer().events.on({
                    sketchcomplete: this._validateText.bind(this),
                    afterfeaturemodified: function() {
                        self.editing_ = null;
                    }
                });
            } else {
                this.editControl = null;
            }
            this.setupMapEventListeners();
            this._trigger('ready');
            if (this.useDialog_ && this.options.auto_activate) {
                this.activate();
            }
        },
        setupMapEventListeners: function() {
            $(document).on('mbmapsrschanged', this._onSrsChange.bind(this));
        },
        defaultAction: function(callback){
            this.activate(callback);
        },
        _createEditControl: function(olLayer) {
            var control = new OpenLayers.Control.ModifyFeature(olLayer, {standalone: true, active: false});
            olLayer.map.addControl(control);
            return control;
        },
        activate: function(callback){
            this.callback = callback ? callback : null;
            if (this.useDialog_) {
                this._open();
            }
            Mapbender.vectorLayerPool.showElementLayers(this, true);
        },
        deactivate: function(){
            this._deactivateControl();
            this._endEdit();
            // end popup, if any
            this._close();
            if (this.options.deactivate_on_close) {
                Mapbender.vectorLayerPool.hideElementLayers(this);
            }
            if (this.callback) {
                (this.callback)();
                this.callback = null;
            }
        },
        // sidepane interaction, safe to use activate / deactivate unchanged
        reveal: function() {
            this.activate();
        },
        hide: function() {
            this.deactivate();
        },
        /**
         * deprecated
         * @param {array} callback
         */
        open: function(callback){
            this.activate(callback);
        },
        /**
         * deprecated
         */
        close: function(){
            this.deactivate();
        },
        _open: function(){
            var self = this;
            if(!this.popup || !this.popup.$element) {
                this.popup = new Mapbender.Popup2({
                    title: Mapbender.trans(this.options.title),
                    draggable: true,
                    header: true,
                    modal: false,
                    closeOnESC: false,
                    content: self.element,
                    width: 500,
                    height: 380,
                    buttons: {
                        'cancel': {
                            label: Mapbender.trans('mb.actions.close'),
                            cssClass: 'button buttonCancel critical right',
                            callback: function(){
                                self.deactivate();
                            }
                        }
                    }
                });
                this.popup.$element.on('close', $.proxy(this.deactivate, this));
            } else {
                    this.popup.open(self.element);
            }
            this.element.removeClass('hidden');
        },
        _close: function(){
            if (this.popup) {
                this.element.addClass('hidden').appendTo($('body'));
                if(this.popup.$element) {
                    this.popup.destroy();
                }
                this.popup = null;
            }
        },
        _toolRequiresLabel: function(toolName) {
            return toolName === 'text';
        },
        _onToolButtonClick: function($button) {
            this._endEdit();
            $('[data-tool-name]', this.element).not($button).removeClass('active');
            if ($button.hasClass('active')) {
                this._deactivateControl();
            } else {
                var toolName = $button.attr('data-tool-name');
                this.$labelInput_.prop('disabled', false);
                this.requireText_ = this._toolRequiresLabel(toolName);
                this._startDraw(toolName);
                $button.addClass('active');
            }
            return false;
        },
        _validateText: function() {
            if (this.requireText_ && !this.$labelInput_.val().trim()) {
                Mapbender.info(Mapbender.trans('mb.core.sketch.error.notext'));
                return false;
            } else {
                return true;
            }
        },
        _onFeatureAdded: function(toolName, feature) {
            this._setFeatureAttribute(feature, 'toolName', toolName);
            var text = this.$labelInput_.val().trim();
            this._updateFeatureLabel(feature, text);
            this.$labelInput_.val('');
            this._addToGeomList(feature);
        },
        _startDraw: function(toolName) {
            var featureAdded = this._onFeatureAdded.bind(this, toolName);
            $('.-fn-tool-off', this.element).prop('disabled', false);
            switch(toolName) {
                case 'point':
                case 'line':
                case 'circle':
                case 'polygon':
                case 'rectangle':
                    this.layer.draw(toolName, featureAdded);
                    break;
                case 'text':
                    this._monkeyPatchLabelCondition(this.layer.draw('point', featureAdded));
                    break;
                default:
                    throw new Error("No implementation for tool name " + toolName);
            }
        },
        _monkeyPatchLabelCondition: function(interaction) {
            // OpenLayers 4 only. OpenLayers 2 handles this via map-global sketchcomplete event
            // Condition cannot be set via public API after creation. So we patch the private attribute 'condition_'
            if (interaction.condition_ && !interaction.monkeyPatchedLabelCondition) {
                var self = this;
                interaction.condition_ = function(event) {
                    // invoke original default handler
                    var original = ol.events.condition.noModifierKeys(event);
                    return original && self._validateText();
                };
                interaction.monkeyPatchedLabelCondition = true;
            }
        },
        /**
         * @param {*} feature
         * @private
         * engine-specific
         */
        _startEdit: function(feature) {
            this.editing_ = feature;
            if (Mapbender.mapEngine.code === 'ol2') {
                this.editControl.selectFeature(feature);
                this.editControl.activate();
            } else {
                // OpenLayer 4 edit control does not support re-selecting a single feature
                // => Always create a new one
                this.editControl = new ol.interaction.Modify({
                    features: new ol.Collection([feature])
                });
                this.mbMap.getModel().olMap.addInteraction(this.editControl);
            }
        },
        _endEdit: function() {
            this.$labelInput_.off('keyup');
            if (this.editControl) {
                if (Mapbender.mapEngine.code === 'ol2') {
                    this.editControl.deactivate();
                } else {
                    this.mbMap.getModel().olMap.removeInteraction(this.editControl);
                    this.editControl.dispose();
                    this.editControl = null;
                }
            }
            this.editing_ = null;
        },
        _deactivateControl: function() {
            this.layer.endDraw();
            this.$labelInput_.prop('disabled', true);
            $('.-fn--tool-off', this.element).prop('disabled', true);
            $('[data-tool-name]', this.element).removeClass('active');
        },
        _getGeomLabel: function(feature) {
            var toolName = this._getFeatureAttribute(feature, 'toolName');
            var typeLabel = this.toolLabels[toolName];
            var featureLabel = this._getFeatureLabel(feature);
            if (featureLabel) {
                return typeLabel + (featureLabel && (' (' + featureLabel + ')') || '');
            } else {
                return typeLabel + ' ' + (++this.geomCounter);
            }
        },
        _addToGeomList: function(feature) {
            var row = this.rowTemplate.clone();
            row.data('feature', feature);
            $('.geometry-name', row).text(this._getGeomLabel(feature));
            var $geomtable = $('.geometry-table', this.element);
            $geomtable.append(row);
        },
        _removeFromGeomList: function(e){
            var $tr = $(e.target).closest('tr');
            var feature = $tr.data('feature');
            if (feature === this.editing_) {
                this.$labelInput_.val('');
                this._endEdit();
            }
            this.layer.removeNativeFeatures([feature]);
            $tr.remove();
        },
        _modifyFeature: function(e) {
            var self = this;
            var $row = $(e.target).closest('tr');
            var eventFeature = $row.data('feature');
            this._deactivateControl();
            this._endEdit();
            this.$labelInput_.val(this._getFeatureLabel(eventFeature));
            this.$labelInput_.prop('disabled', false);
            this.$labelInput_.on('keyup', function() {
                if (self._validateText()) {
                    var text = $(this).val().trim();
                    self._updateFeatureLabel(eventFeature, text);
                    var label = self._getGeomLabel(eventFeature);
                    $('.geometry-name', $row).text(label);
                }
            });
            this._startEdit(eventFeature);
        },
        _zoomToFeature: function(e){
            this._deactivateControl();
            var feature = $(e.target).closest('tr').data('feature');
            this.mbMap.getModel().zoomToFeature(feature);
        },
        _getFeatureLabel: function(feature) {
            return this._getFeatureAttribute(feature, 'label') || '';
        },
        _updateFeatureLabel: function(feature, label) {
            this._setFeatureAttribute(feature, 'label', label);
            // OpenLayers 2 only
            if (feature.layer) {
                feature.layer.redraw();
            }
        },
        /**
         * @param {*} feature
         * @param {String} name
         * @private
         * engine-specific
         */
        _getFeatureAttribute: function(feature, name) {
            if (Mapbender.mapEngine.code === 'ol2') {
                return feature.attributes[name];
            } else {
                return feature.get(name);
            }
        },
        /**
         * @param {*} feature
         * @param {String} name
         * @param {*} value
         * @private
         * engine-specific
         */
        _setFeatureAttribute: function(feature, name, value) {
            if (Mapbender.mapEngine.code === 'ol2') {
                feature.attributes[name] = value;
            } else {
                feature.set(name, value);
            }
        },
        _onSrsChange: function(event, data) {
            this._endEdit();
            this._deactivateControl();
            if (this.layer) {
                this.layer.retransform(data.from, data.to);
            }
        }
    });

})(jQuery);
