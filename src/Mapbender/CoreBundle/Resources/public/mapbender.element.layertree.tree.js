(function($) {
    $.widget("mapbender.mbLayertree", {
        options: {
            type: 'element',
            autoOpen: false,
            useTheme: false,
            target: null,
            showBaseSource: true,
            allowReorder: true,
            hideSelect: false,
            hideInfo: false,
            themes: null,
            menu: []
        },
        model: null,
        template: null,
        menuTemplate: null,
        popup: null,
        consts: {
            source: "source",
            theme: "theme",
            root: "root",
            group: "group",
            simple: "simple"
        },
        _mobilePane: null,
        useDialog_: false,
        isTouch_: false,

        _create: function() {
            // see https://stackoverflow.com/a/4819886
            this.isTouch_ = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
            this.useDialog_ = !this.element.closest('.sideContent,.mobilePane').length;
            var self = this;
            this._mobilePane = $(this.element).closest('#mobilePane').get(0) || null;
            Mapbender.elementRegistry.waitReady('.mb-element-map').then(function(mbMap) {
                self._setup(mbMap);
            }, function() {
                Mapbender.checkTarget('mbLayertree');
            });
        },
        _setup: function(mbMap) {
            this.elementUrl = Mapbender.configuration.application.urls.element + '/' + this.element.attr('id') + '/';
            this.template = $('li.-fn-template', this.element).remove();
            this.template.removeClass('hidden -fn-template');
            this.menuTemplate = $('.layer-menu', this.template).remove();
            this.menuTemplate.removeClass('hidden');
            this.themeTemplate = $('li.-fn-theme-template', this.element).remove();
            this.themeTemplate.removeClass('hidden -fn-theme-template');

            this.model = mbMap.getModel();
            this._createTree();
            if (this.useDialog_ && this.options.autoOpen) {
                this.open();
            }
            this._createEvents();
            this._trigger('ready');
        },
        _createTree: function() {
            var sources = this.model.getSources();
            $('ul.layers:first', this.element).empty();
            for (var i = (sources.length - 1); i > -1; i--) {
                if (this.options.showBaseSource || !sources[i].configuration.isBaseSource) {
                    var source = sources[i];
                    var $sourceNode = this._createSourceTree(sources[i]);
                    var themeOptions = this.options.useTheme && this._getThemeOptions(source.layerset);
                    if (themeOptions) {
                        var $themeNode = this._findThemeNode(source.layerset);
                        if (!$themeNode.length) {
                            $themeNode = this._createThemeNode(source.layerset, themeOptions);
                            $('ul.layers:first', this.element).append($themeNode);
                        }
                        $('ul.layers:first', $themeNode).append($sourceNode);
                    } else {
                        $("ul.layers:first", this.element).append($sourceNode);
                    }
                    this._resetSourceAtTree(sources[i]);
                }
            }

            this._reset();
        },
        _reset: function() {
            // Prevent initializing sortable on touch devices, as it breaks touch clicks on folder toggle
            if (this.options.allowReorder && !this.isTouch_) {
                this._createSortable();
            }
        },
        _createEvents: function() {
            var self = this;
            this.element.on('click', '.-fn-toggle-theme', $.proxy(self._toggleSourceVisibility, self));
            this.element.on('click', '.-fn-toggle-info:not(.disabled)', $.proxy(self._toggleInfo, self));
            this.element.on('click', '.-fn-toggle-children', $.proxy(this._toggleFolder, this));
            this.element.on('click', '.-fn-toggle-layer:not(.disabled)', $.proxy(self._toggleSelected, self));
            this.element.on('click', '.layer-menu-btn', $.proxy(self._toggleMenu, self));
            this.element.on('click', '.layer-menu .exit-button', function() {
                $(this).closest('.layer-menu').remove();
            });
            this.element.on('click', '.layer-remove-btn', function() {
                var $node = $(this).closest('li.leave');
                var layer = $node.data('layer');
                self.model.removeLayer(layer);
            });
            this.element.on('click', '.layer-metadata', function(evt) {
                self._showMetadata(evt);
            });
            $(document).bind('mbmapsourceloadstart', $.proxy(self._onSourceLoadStart, self));
            $(document).bind('mbmapsourceloadend', $.proxy(self._onSourceLoadEnd, self));
            $(document).bind('mbmapsourceloaderror', $.proxy(self._onSourceLoadError, self));
            $(document).bind('mbmapsourceadded', $.proxy(self._onSourceAdded, self));
            $(document).bind('mbmapsourcechanged', $.proxy(self._onSourceChanged, self));
            $(document).bind('mbmapsourceremoved', $.proxy(self._onSourceRemoved, self));
            $(document).bind('mbmapsourcelayerremoved', $.proxy(this._onSourceLayerRemoved, this));
            $(document).on('mb.sourcenodeselectionchanged', function(e, data) {
                if (data.node instanceof (Mapbender.Layerset)) {
                    self._updateThemeNode(data.node);
                }
            });
            if (this._mobilePane) {
                $(this.element).on('click', '.leaveContainer', function() {
                    $('.-fn-toggle-layer', this).click();
                });
            }
        },
        /**
         * Applies the new (going by DOM) layer order inside a source.
         *
         * @param $sourceContainer
         * @private
         */
        _updateSource: function($sourceContainer) {
            // this will capture the "configurationish" layer ids (e.g. "1_0_4_1") from
            // all layers in the source container in DOM order
            var sourceId = $sourceContainer.attr('data-sourceid');
            var layerIdOrder = [];
            $('li.leave[data-type="simple"]', $sourceContainer).each(function() {
                var $t = $(this);
                var layerId = $t.attr('data-id');
                if (typeof layerId !== "undefined") {
                    layerIdOrder.push("" + layerId);
                }
            });
            this.model.setSourceLayerOrder(sourceId, layerIdOrder.reverse());
        },
        /**
         * Applies the new (going by DOM) ordering between sources.
         *
         * @private
         */
        _updateSourceOrder: function() {
            var $roots = $('ul.layers li[data-type="root"]', this.element);
            var sourceIds = $roots.map(function() {
                return $(this).attr('data-sourceid');
            }).get().reverse();
            this.model.reorderSources(sourceIds);
        },
        _createSortable: function() {
            var self = this;
            var onUpdate = function(event, ui) {
                var $elm = $(ui.item);
                var type = $elm.attr('data-type');
                switch (type) {
                    case 'theme':
                    case 'root':
                        self._updateSourceOrder();
                        break;
                    case 'simple':
                    case 'group':
                        self._updateSource($elm.closest('.serviceContainer'));
                        break;
                    default:
                        console.warn("Warning: unhandled element in layertree sorting", type, $elm);
                        break;
                }
            };

            $("ul.layers", this.element).each(function() {
                $(this).sortable({
                    axis: 'y',
                    items: "> li",
                    distance: 6,
                    cursor: "move",
                    update: onUpdate
                });
            });
        },
        _createThemeNode: function(layerset, options) {
            var $li = this.themeTemplate.clone();
            $li.attr('data-type', this.consts.theme);
            $li.attr('data-layersetid', layerset.id);
            $li.toggleClass('showLeaves', options.opened);
            $('.-fn-toggle-children', $li).toggleClass('iconFolderActive', options.opened);
            $('span.layer-title:first', $li).text(layerset.getTitle() || '');
            this._updateThemeNode(layerset, $li);
            return $li;
        },
        _updateThemeNode: function(layerset, $node) {
            var $node_ = $node || this._findThemeNode(layerset);
            var $themeControl = $('> .leaveContainer .-fn-toggle-theme', $node_);
            if ($themeControl.length > 1) {
                console.log("Multiple themes?!", $themeControl.get());
            }
            var newState = layerset.getSelected();
            this.updateIconVisual_($themeControl, newState, true);
        },
        _getThemeOptions: function(layerset) {
            var matches =  (this.options.themes || []).filter(function(item) {
                return item.useTheme && ('' + item.id) === ('' + layerset.id);
            });
            return matches[0] || null;
        },
        _findThemeNode: function(layerset) {
            return $('ul.layers:first > li[data-layersetid="' + layerset.id + '"]', this.element);
        },
        _createLayerNode: function(layer) {
            var treeOptions = layer.options.treeOptions;
            if (!treeOptions.selected && !treeOptions.allow.selected) {
                return null;
            }

            var $li = this.template.clone();
            $li.data('layer', layer);

            $li.attr('data-id', layer.options.id);
            $li.attr('data-sourceid', layer.source.id);
            var nodeType;
            var $childList = $('ul.layers', $li);
            if (this.options.hideInfo || (layer.children && layer.children.length)) {
                $('.-fn-toggle-info', $li).remove();
            }
            if (layer.children && layer.children.length) {
                if (layer.getParent()) {
                    $li.addClass("groupContainer");
                    nodeType = this.consts.group;
                } else {
                    $li.addClass("serviceContainer");
                    nodeType = this.consts.root;
                }
                $li.toggleClass('showLeaves', treeOptions.toggle);
                var $folder = $('.-fn-toggle-children', $li);
                $folder.toggleClass('iconFolderActive', treeOptions.toggle);
                if (this.options.hideSelect && treeOptions.selected && !treeOptions.allow.selected) {
                    $('.-fn-toggle-layer', $li).remove();
                }
                for (var j = layer.children.length - 1; j >= 0; j--) {
                    $childList.append(this._createLayerNode(layer.children[j]));
                }
            } else {
                $('.-fn-toggle-children', $li).remove();
                nodeType = this.consts.simple;
                $childList.remove();
            }
            $li.attr('data-type', nodeType);
            this._updateLayerDisplay($li, layer);
            $li.find('.layer-title:first')
                .attr('title', layer.options.title)
                .text(layer.options.title)
            ;

            return $li;
        },
        _createSourceTree: function(source) {
            var li = this._createLayerNode(source.configuration.children[0]);
            return li;
        },
        _onSourceAdded: function(event, data) {
            var source = data.source;
            if (source.configuration.baseSource && !this.options.showBaseSource) {
                return;
            }
            var li_s = this._createSourceTree(source);
            // Insert on top
            $('ul.layers:first', this.element).prepend(li_s);
            this._reset();
        },
        _onSourceChanged: function(event, data) {
            this._resetSourceAtTree(data.source);
        },
        _onSourceLayerRemoved: function(event, data) {
            var layer = data.layer;
            var layerId = layer.options.id;
            var sourceId = layer.source.id;
            var $node = $('[data-sourceid="' + sourceId + '"][data-id="' + layerId + '"]', this.element);
            $node.remove();
        },
        _redisplayLayerState: function($li, layer) {
            var $title = $('>.leaveContainer .layer-title', $li);
            // NOTE: outOfScale is only calculated for leaves. May be null
            //       for intermediate nodes.
            $li.toggleClass('state-outofscale', !!layer.state.outOfScale);
            $li.toggleClass('state-outofbounds', !!layer.state.outOfBounds);
            $li.toggleClass('state-deselected', !layer.getSelected());
            var tooltipParts = [layer.options.title];
            if (layer.state.outOfScale) {
                tooltipParts.push(Mapbender.trans("mb.core.layertree.const.outofscale"));
            }
            if (layer.state.outOfBounds) {
                tooltipParts.push(Mapbender.trans("mb.core.layertree.const.outofbounds"));
            }
            $title.attr('title', tooltipParts.join("\n"));
        },
        _resetSourceAtTree: function(source) {
            var self = this;
            function resetLayer(layer) {
                var $li = $('li[data-id="' + layer.options.id + '"]', self.element);
                self._updateLayerDisplay($li, layer);
                if (layer.children) {
                    for (var i = 0; i < layer.children.length; i++) {
                        resetLayer(layer.children[i]);
                    }
                }
            }
            resetLayer(source.configuration.children[0]);
        },
        _updateLayerDisplay: function($li, layer) {
            if (layer && layer.state && Object.keys(layer.state).length) {
                this._redisplayLayerState($li, layer);
            }
            if (layer && Object.keys((layer.options || {}).treeOptions).length) {
                var $checkboxScope = $('>.leaveContainer', $li);
                this._updateLayerCheckboxes($checkboxScope, layer.options.treeOptions);
            }
        },
        _updateLayerCheckboxes: function($scope, treeOptions) {
            var allow = treeOptions.allow || {};
            var $layerControl = $('.-fn-toggle-layer', $scope);
            var $infoControl = $('.-fn-toggle-info', $scope);
            this.updateIconVisual_($layerControl, treeOptions.selected, allow.selected);
            this.updateIconVisual_($infoControl, treeOptions.info, allow.info);
        },
        _onSourceRemoved: function(event, removed) {
            if (removed && removed.source && removed.source.id) {
                var $source = $('ul.layers:first li[data-sourceid="' + removed.source.id + '"]', this.element);
                var $theme = $source.parents('.themeContainer:first');
                $('ul.layers:first li[data-sourceid="' + removed.source.id + '"]', this.element).remove();
                if ($theme.length && $theme.find('.serviceContainer').length === 0){
                    $theme.remove();
                }
            }
        },
        _getSourceNode: function(sourceId) {
            return $('li[data-sourceid="' + sourceId + '"][data-type="root"]', this.element);
        },
        _onSourceLoadStart: function(event, options) {
            var sourceId = options.source && options.source.id;
            var $sourceEl = sourceId && this._getSourceNode(sourceId);
            $sourceEl.addClass('state-loading');
        },
        _onSourceLoadEnd: function(event, options) {
            var sourceId = options.source && options.source.id;
            var $sourceEl = sourceId && this._getSourceNode(sourceId);
            $sourceEl.removeClass('state-loading state-error');

            if ($sourceEl && $sourceEl.length) {
                this._resetSourceAtTree(options.source);
            }
        },
        _onSourceLoadError: function(event, options) {
            var sourceId = options.source && options.source.id;
            var $sourceEl = sourceId && this._getSourceNode(sourceId);
            $sourceEl.removeClass('state-loading').addClass('state-error');
        },
        _toggleFolder: function(e) {
            var $me = $(e.target);
            var layer = $(e.target).closest('li.leave').data('layer');
            if (layer && (!layer.children || !layer.options.treeOptions.allow.toggle)) {
                return false;
            }
            var $node = $me.closest('.leave,.themeContainer');
            var active = $node.hasClass('showLeaves');
            $node.toggleClass('showLeaves', !active);
            $me.toggleClass('iconFolderActive', !active);
            return false;
        },
        _toggleSourceVisibility: function(e) {
            var $themeControl = $(e.target);
            var newState = !$themeControl.hasClass('active');
            this.updateIconVisual_($themeControl, newState, true);
            var $themeNode = $themeControl.closest('.themeContainer');
            var themeId = $themeNode.attr('data-layersetid');
            var theme = Mapbender.layersets.filter(function(x) {
                return x.id === themeId;
            })[0];
            this.model.controlTheme(theme, newState);
            if (this._mobilePane) {
                $('#mobilePaneClose', this._mobilePane).click();
            }
            return false;
        },
        _toggleSelected: function(e) {
            var $target = $(e.target);
            var newState = !$target.hasClass('active');
            this.updateIconVisual_($target, newState, null);
            var layer = $target.closest('li.leave').data('layer');
            var source = layer && layer.source;
            if (layer.parent) {
                this.model.controlLayer(layer, newState);
            } else {
                this.model.setSourceVisibility(source, newState);
            }
            if (this._mobilePane) {
                $('#mobilePaneClose', this._mobilePane).click();
            }
            return false;
        },
        _toggleInfo: function(e) {
            var $target = $(e.target);
            var newState = !$target.hasClass('active');
            $target.toggleClass('iconInfoActive active', newState);
            $target.toggleClass('iconInfo', !newState);
            var layer = $target.closest('li.leave').data('layer');
            this.model.controlLayer(layer, null, newState);
        },
        _initMenu: function($layerNode) {
            var layer = $layerNode.data('layer');
            var source = layer.source;
            var menu = $(this.menuTemplate.clone());
            var mapModel = this.model;
            if (layer.getParent()) {
                $('.layer-control-root-only', menu).remove();
            }
            var atLeastOne = !!$('.layer-remove-btn', menu).length;

            // element must be added to dom and sized before Dragdealer init...
            $('.leaveContainer:first', $layerNode).after(menu);

            var $opacityControl = $('.layer-control-opacity', menu);
            if ($opacityControl.length) {
                atLeastOne = true;
                var $handle = $('.layer-opacity-handle', $opacityControl);
                $handle.attr('unselectable', 'on');
                new Dragdealer($('.layer-opacity-bar', $opacityControl).get(0), {
                    x: source.configuration.options.opacity,
                    horizontal: true,
                    vertical: false,
                    speed: 1,
                    steps: 100,
                    handleClass: "layer-opacity-handle",
                    animationCallback: function(x, y) {
                        var opacity = Math.max(0.0, Math.min(1.0, x));
                        var percentage = Math.round(opacity * 100);
                        $handle.text(percentage);
                        mapModel.setSourceOpacity(source, opacity);
                    }
                });
            }
            var $zoomControl = $('.layer-zoom', menu);
            if ($zoomControl.length && layer.hasBounds()) {
                atLeastOne = true;
                $zoomControl.on('click', $.proxy(this._zoomToLayer, this));
            } else {
                $zoomControl.remove();
            }
            if (layer.options.metadataUrl && $('.layer-metadata', menu).length) {
                atLeastOne = true;
            } else {
                $('.layer-metadata', menu).remove();
            }

            var dims = source.configuration.options.dimensions || [];
            var $dimensionsControl = $('.layer-control-dimensions', menu);
            if (dims.length && $dimensionsControl.length) {
                this._initDimensionsMenu($layerNode, menu, dims, source);
                atLeastOne = true;
            } else {
                $dimensionsControl.remove();
            }
            if (!atLeastOne) {
                menu.remove();
            }
        },
        _toggleMenu: function(e) {
            var $target = $(e.target);
            var $layerNode = $target.closest('li.leave');
            if (!$('>.layer-menu', $layerNode).length) {
                $('.layer-menu', this.element).remove();
                this._initMenu($layerNode);
            }
            return false;
        },
        _initDimensionsMenu: function($element, menu, dims, source) {
            var self = this;
            var dimData = $element.data('dimensions') || {};
            var template = $('.layer-control-dimensions', menu);
            var $controls = [];
            var dragHandlers = [];
            var updateData = function(key, props) {
                $.extend(dimData[key], props);
                var ourData = {};
                ourData[key] = dimData[key];
                var mergedData = $.extend($element.data('dimensions') || {}, ourData);
                $element.data('dimensions', mergedData);
            };
            $.each(dims, function(idx, item) {
                var $control = template.clone();
                var label = $('.layer-dimension-title', $control);

                var dimDataKey = source.id + '~' + idx;
                dimData[dimDataKey] = dimData[dimDataKey] || {
                    checked: false
                };
                var inpchkbox = $('input[type="checkbox"]', $control);
                inpchkbox.data('dimension', item);
                inpchkbox.prop('checked', dimData[dimDataKey].checked);
                inpchkbox.on('change', function(e) {
                    updateData(dimDataKey, {checked: $(this).prop('checked')});
                    self._callDimension(source, $(e.target));
                });
                label.attr('title', label.attr('title') + ' ' + item.name);
                $('.layer-dimension-bar', menu).toggleClass('hidden', item.type === 'single');
                $('.layer-dimension-textfield', $control)
                    .toggleClass('hidden', item.type !== 'single')
                    .val(dimData.value || item.extent)
                ;
                if (item.type === 'single') {
                    inpchkbox.attr('data-value', dimData.value || item.extent);
                    updateData(dimDataKey, {value: dimData.value || item.extent});
                } else if (item.type === 'multiple' || item.type === 'interval') {
                    var dimHandler = Mapbender.Dimension(item);
                    dragHandlers.push(new Dragdealer($('.layer-dimension-bar', $control).get(0), {
                        x: dimHandler.getStep(dimData[dimDataKey].value || dimHandler.getDefault()) / dimHandler.getStepsNum(),
                        horizontal: true,
                        vertical: false,
                        speed: 1,
                        steps: dimHandler.getStepsNum(),
                        handleClass: 'layer-dimension-handle',
                        callback: function(x, y) {
                            self._callDimension(source, inpchkbox);
                        },
                        animationCallback: function(x) {
                            var step = Math.round(dimHandler.getStepsNum() * x);
                            var value = dimHandler.valueFromStep(step);
                            label.text(value);
                            updateData(dimDataKey, {value: value});
                            inpchkbox.attr('data-value', value);
                        }
                    }));
                } else {
                    Mapbender.error("Source dimension " + item.type + " is not supported.");
                }
                $controls.push($control);
            });
            template.replaceWith($controls);
            dragHandlers.forEach(function(dh) {
                dh.reflow();
            });
        },
        _callDimension: function(source, chkbox) {
            var dimension = chkbox.data('dimension');
            var paramName = dimension['__name'];
            if (chkbox.is(':checked') && paramName) {
                var params = {};
                params[paramName] = chkbox.attr('data-value');
                source.addParams(params);
            } else if (paramName) {
                source.removeParams([paramName]);
            }
            return true;
        },
        _zoomToLayer: function(e) {
            var layer = $(e.target).closest('li.leave', this.element).data('layer');
            var options = {
                sourceId: layer.source.id,
                layerId: layer.options.id
            };
            this.model.zoomToLayer(options);
        },
        _showMetadata: function(e) {
            var layer = $(e.target).closest('li.leave', this.element).data('layer');
            var url = layer.options.metadataUrl;
            $.ajax(url)
                .then(function(response) {
                    var metadataPopup = new Mapbender.Popup2({
                        title: Mapbender.trans("mb.core.metadata.popup.title"),
                        cssClass: 'metadataDialog',
                        modal: false,
                        resizable: true,
                        draggable: true,
                        content: $(response),
                        destroyOnClose: true,
                        width: 850,
                        height: 600,
                        buttons: [{
                            label: Mapbender.trans('mb.core.metadata.popup.btn.ok'),
                            cssClass: 'button buttonCancel critical right',
                            callback: function() {
                                this.close();
                            }
                        }]
                    });
                    if (initTabContainer) {
                        initTabContainer(metadataPopup.$element);
                    }
                }, function(jqXHR, textStatus, errorThrown) {
                    Mapbender.error(errorThrown);
                })
            ;
        },
        /**
         * Default action for mapbender element
         */
        defaultAction: function(callback) {
            this.open(callback);
        },
        /**
         * Opens a popup dialog
         */
        open: function(callback) {
            this.callback = callback ? callback : null;
            if (this.useDialog_) {
                var self = this;
                if (!this.popup || !this.popup.$element) {
                    this.popup = new Mapbender.Popup2({
                        title: self.element.attr('data-title'),
                        modal: false,
                        resizable: true,
                        draggable: true,
                        closeOnESC: false,
                        detachOnClose: false,
                        content: [self.element.show()],
                        width: 350,
                        height: 500,
                        cssClass: 'customLayertree',
                        buttons: {
                            'ok': {
                                label: Mapbender.trans("mb.core.layertree.popup.btn.ok"),
                                cssClass: 'button right',
                                callback: function() {
                                    self.close();
                                }
                            }
                        }
                    });
                    this.popup.$element.on('close', $.proxy(this.close, this));
                } else {
                    this.popup.$element.show();
                }
            }
            this._reset();
        },
        /**
         * Closes the popup dialog
         */
        close: function() {
            if (this.useDialog_) {
                if (this.popup && this.popup.$element) {
                    this.popup.$element.hide();
                }
            }
            if (this.callback) {
                (this.callback)();
                this.callback = null;
            }
        },
        updateIconVisual_: function($el, active, enabled) {
            if (active !== null && (typeof active !== 'undefined')) {
                $el.toggleClass(['active', $el.attr('data-icon-on')].join(' '), !!active);
                $el.toggleClass($el.attr('data-icon-off'), !active);
            }
            if (enabled !== null && (typeof enabled !== 'undefined')) {
                $el.toggleClass('disabled', !enabled);
            }
        },
        _destroy: $.noop
    });

})(jQuery);
