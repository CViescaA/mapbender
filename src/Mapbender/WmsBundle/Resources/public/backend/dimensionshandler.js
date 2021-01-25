$(function () {
    var collectionSelector = '#form_configuration_dimensionsets .collectionItem';
    var selectSelector = 'select[data-name="group"]';
    var dimHandler = {
        update: function($item, dimension, minStep, maxStep, store) {
            var $storeInput = $('input[data-name="dimension"]', $item);
            var min = dimension.valueFromStep(minStep);
            var max = dimension.valueFromStep(maxStep);
            var dimInstanceSettings = JSON.parse($storeInput.val() || '""') || $.extend(true, {}, dimension.getOptions());
            var defaultValue = dimension.getInRange(min, max, dimension.getMax());
            if (store) {
                dimInstanceSettings.extent[0] = min;
                dimInstanceSettings.extent[1] = max;
                dimInstanceSettings.default = defaultValue;
                $storeInput.val(JSON.stringify(dimInstanceSettings || ''));
            }
            var displayText = [[min, max, dimension.options.extent[2]].join('/'), defaultValue].join(' - ');
            $('input[data-name="extentDisplay"]', $item).val(displayText);
        },
        getSliderSettings: function($item) {
            var dimInstanceSettings = JSON.parse($('input[data-name="dimension"]', $item).val() || '""') || {};
            return (dimInstanceSettings.extent || false) && {
                min: dimInstanceSettings.extent[0],
                max: dimInstanceSettings.extent[1],
                default: dimInstanceSettings.default
            };
        },
        getDimension: function($item) {
            var dimensionOptions = JSON.parse($('input[data-name="dimension"]', $item).val() || '""') || {};
            var dimension;
            var $selected = $(selectSelector + ' option:selected', $item);
            for (var i = 0; i < $selected.length; ++i) {
                dimensionOptions = JSON.parse($($selected.get(i)).attr('data-config'));
                var nextDim = Mapbender.Dimension(dimensionOptions);
                if (dimension) {
                    dimension = dimension.innerJoin(nextDim) || dimension;
                } else {
                    dimension = nextDim;
                }
            }
            return dimension;
        },
        initSlider: function ($item) {
            var self = this;
            var $slider = $('.mb-slider', $item);
            var currentSettings = this.getSliderSettings($item);
            var dimension = this.getDimension($item);

            if (dimension) {
                var sliderRange = [0, dimension.getStepsNum()];
                var sliderValues = currentSettings && [
                    Math.max(0, dimension.getStep(currentSettings.min)),
                    Math.min(sliderRange[1], dimension.getStep(currentSettings.max))
                ];
                sliderValues = sliderValues || sliderRange.slice();
                this.update($item, dimension, sliderValues[0], sliderValues[1], false);
                $slider.slider({
                    range: true,
                    min: sliderRange[0],
                    max: sliderRange[1],
                    values: sliderValues,
                    slide: function (event, ui) {
                        self.update($item, dimension, ui.values[0], ui.values[1], true);
                    }
                });
                $slider.addClass('-created');
            } else {
                if ($slider.hasClass('-created')) {
                    $slider.slider("destroy");
                    $slider.removeClass('-created');
                }
            }
        }
    };
    var usedValues = [];
    var updateCollection = function updateCollection() {
        var $selects = $([collectionSelector, selectSelector].join(' '));
        usedValues = [];

        $selects.each(function() {
            usedValues = usedValues.concat($(this).val());
        });
        usedValues = _.uniq(usedValues);
        $('option', $selects).each(function() {
            $(this).prop('disabled', (usedValues.indexOf(this.value) !== -1) && !$(this).is(':selected'));
        });
    };

    $(document).on('change', 'select[data-name="group"]', function (event) {
        var $item = $(event.target).closest('.collectionItem');
        dimHandler.initSlider($item);
        updateCollection();
        return false;
    });
    $(document).on('click', '.collectionAdd', function (event) {
        var $collection = $(event.currentTarget).closest('[data-prototype]');
        var nOpts = $(selectSelector + ' > option').length;
        if (usedValues.length >= nOpts) {
            // return false;   // no worky, we can't prevent creation from here :\
        }
        var $new = $('.collectionItem', $collection).last();    // :)
        $('select[data-name="group"]', $new).trigger('change');
    });
    $(collectionSelector).each(function(ix, item) {
        var $item = $(item);
        dimHandler.initSlider($item);
    });
});
