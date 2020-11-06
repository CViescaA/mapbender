/**
 * Migrated to Mapbender from FOM v3.0.6.3
 * See https://github.com/mapbender/fom/tree/v3.0.6.3/src/FOM/CoreBundle/Resources/public/js
 */
$(function() {
    // init tabcontainers --------------------------------------------------------------------
    var tabs = $(".tabContainer").find(".tab");
    tabs.attr("tabindex", 0);
    tabs.bind("click keypress", function(e) {
        if (e.type === "keypress" && e.keyCode !== 13) {
            return;
        }

        var me = $(this);
        var tabcont = me.parent().parent();
        $('>.tabs >.tab, >.container', tabcont).removeClass('active');
        me.addClass("active");
        $("#" + me.attr("id").replace("tab", "container"), tabcont).addClass("active");
    });
    var activeTab = (window.location.hash || '').substring(1);
    $(".tabContainer, .tabContainerAlt").on('click', '.tab', function() {
        var tabId = $(this).attr('id');
        // rewrite url fragment without scrolling page
        // see https://stackoverflow.com/questions/3870057/how-can-i-update-window-location-hash-without-jumping-the-document
        window.history.replaceState(null, null, '#' + tabId);
    });
    if (activeTab) {
        $('#' + activeTab, $('.tabContainer, .tabContainerAlt')).click();
    }

    // List toggles used in source views (collapsible layer / matrix nodes)
    $(".openCloseTitle").on("click", function() {
        var $title = $(this);
        var $list = $title.parent();
        if ($list.hasClass("closed")) {
            $title.removeClass("iconExpandClosed").addClass("iconExpand");
            $list.removeClass("closed");
        }else{
            $title.addClass("iconExpandClosed").removeClass("iconExpand");
            $list.addClass("closed");
        }
    });

    // init filter inputs --------------------------------------------------------------------
    $(document).on("keyup", ".listFilterInput", function(){
        var $this = $(this);
        var val = $.trim($this.val());
        var filterTargetId = $this.attr('data-filter-target');
        if (!filterTargetId) {
            filterTargetId = $this.attr('id').replace("input", "list");
        }
        var filterScope = filterTargetId && $('#' + filterTargetId);
        if (!filterTargetId || !filterScope.length) {
            console.error("Could not find target for list filter", this, filterTargetId);
            return;
        }
        var items = $("li, tr", filterScope).not('.doNotFilter');

        if(val.length > 0){
            $.each(items, function() {
                var $item = $(this);
                var containsInput = $item.text().toUpperCase().indexOf(val.toUpperCase()) !== -1;
                $item.toggle(containsInput);
            });
        }else{
            items.show();
        }
    });

    // init validation feedback --------------------------------------------------------------
    $(document).on("keypress", ".validationInput", function(){
      $(this).siblings(".validationMsgBox").hide();
    });

    var flashboxes = $(".flashBox").addClass("kill");
    // kill all flashes ---------------------------------------------------------------------
    flashboxes.each(function(idx, item){
        if(idx === 0){
            $(item).removeClass("kill");
        }
        setTimeout(function(){
            $(item).addClass("kill");
            if(flashboxes.length - idx !== 1){
                $(flashboxes.get(idx + 1)).removeClass("kill");
            }
        }, (idx + 1) * 2000);
    });

    // init user box -------------------------------------------------------------------------
    $("#accountOpen").bind("click", function(){
        var menu = $("#accountMenu");
        if(menu.hasClass("opened")){
            menu.removeClass("opened");
        }else{
            menu.addClass("opened");
        }
    });

    // init permissions table ----------------------------------------------------------------
    // set permission root state
    function setPermissionsRootState(className, scope){
        var root         = $('thead .tagbox[data-perm-type="' + className + '"]', scope);
        var permBody     = $("tbody", scope);
        var rowCount     = permBody.find("tr").length;
        var checkedCount = permBody.find(".tagbox." + className + ' input[type="checkbox"]:checked').length;
        root.toggleClass("active", !!rowCount && checkedCount === rowCount);
        root.toggleClass("multi", !!(rowCount && checkedCount) && checkedCount < rowCount);
    }
    // toggle all permissions
    var toggleAllPermissions = function(scope){
        var self           = $(this);
        var className    = self.attr("data-perm-type");
        var permElements = $("tbody .checkWrapper[data-perm-type=" + className + "]", scope);
        var state        = !self.hasClass("active");
        $('input[type="checkbox"]', permElements).prop('checked', state).each(function() {
            $(this).parent().toggleClass("active", state);
        });

        // change root permission state
        setPermissionsRootState(className, scope);
    };
    function appendAces($permissionsTable, $sidSelector, defaultPermissions) {
        var body = $("tbody", $permissionsTable);
        var proto = $("thead", $permissionsTable).attr("data-prototype");

        var count = body.find("tr").length;
        $('input[type="checkbox"]:checked', $sidSelector).each(function() {
            // see FOM/UserBundle/Resoruces/views/ACL/groups-and-users.html.twig
            var $row = $(this).closest('tr');
            var sid = $('span.hide', $row).text();
            var sidType = (sid.split(':')[0]).toUpperCase();
            var text = $row.find(".labelInput").text().trim();
            var newEl = $(proto.replace(/__name__/g, count++));
            newEl.addClass('new');
            newEl.attr('data-sid', sid);
            $('.labelInput', newEl).text(text);
            body.prepend(newEl);
            newEl.find(".input").attr("value", sid);
            (defaultPermissions || []).map(function(permissionName) {
                $('.tagbox[data-perm-type="' + permissionName + '"]', newEl).trigger('click');
            });
            $('.userType', newEl)
                .toggleClass('iconGroup', sidType === 'R')
                .toggleClass('iconUser', sidType === 'U')
            ;
        });
        // if table was previously empty, reveal it and hide placeholder text
        $permissionsTable.removeClass('hidden');
        $('#permissionsDescription', $permissionsTable.parent()).addClass('hidden');
    }
    function filterSidContent(response, $permissionsTable) {
        var $content = $(response);
        $('tbody tr.filterItem', $content).each(function() {
            var groupUserItem = $(this);
            // see FOM/UserBundle/Resoruces/views/ACL/groups-and-users.html.twig
            var newItemSid = $('span.hide', groupUserItem).text();
            $('tbody .userType', $permissionsTable).each(function() {
                var existingRowSid = $(this).closest('tr').attr('data-sid');

                if (existingRowSid === newItemSid) {
                    groupUserItem.remove();
                }
            });
        });
        return $content;
    }

    var initPermissionRoot = function() {
        var $table = $(this);
        var $head = $('thead', this);

        $head.find(".tagbox").each(function() {
            setPermissionsRootState($(this).attr("data-perm-type"), $table);
        });
        $head.on('click', '.tagbox', function() {
            toggleAllPermissions.call(this, $table);
        });
    };
    // toggle permission Event
    var togglePermission = function(){
        var $this = $(this);
        var scope = $this.closest('table');
        setPermissionsRootState($this.attr("data-perm-type"), scope);
    };
    $(document).on("click", ".permissionsTable .checkWrapper", togglePermission);

    // add user or groups
    // Remaining FOM markup uses an anchor with a href, which allows undesirable "open in new tab" interactions and
    // also causes some CSS quirks
    // Modern markup uses a div with a data-href attribute
    // @todo: scoping; unscoped, there can only be one user list in the markup at any given time
    $(".-fn-add-permission, #addPermission").bind("click", function(event) {
        event.preventDefault();
        event.stopPropagation();
        var $this = $(this);
        var url = $this.attr('data-url') || $this.attr("href");
        var $targetTable = $('.permissionsTable', $this.closest('.tabContainer,.container,.popup'));

        if (url.length > 0) {
            $.ajax({
                url: url
            }).then(function(response) {
                var popup = new Mapbender.Popup({
                    title: Mapbender.trans('mb.manager.managerbundle.add_user_group'),
                    content: filterSidContent(response, $targetTable), //response,
                    buttons: [
                        {
                            label: Mapbender.trans('mb.actions.add'),
                            cssClass: 'button',
                            callback: function() {
                                appendAces($targetTable, $('#listFilterGroupsAndUsers', popup.$element), ['view']);
                                this.close();
                            }
                        },
                        {
                            label: Mapbender.trans('mb.actions.cancel'),
                            cssClass: 'button buttonCancel critical popupClose'
                        }
                    ]
                });
            });
        }

        return false;
    });
    $(".permissionsTable").on("click", '.iconRemove', function() {
        var $row = $(this).closest('tr');
        var userGroup = ($('.iconUser', $row).length  ? "user " : "group ") + $('.labelInput', $row).text();
        var content = [
            '<div>',
            Mapbender.trans('mb.manager.components.popup.delete_user_group.content',{'userGroup': userGroup}),
            '</div>'
            ].join('');
        var labels = {
            // @todo: bring your own translation string
            title: "mb.manager.components.popup.delete_element.title",
            confirm: "mb.actions.delete",
            cancel: "mb.actions.cancel"
        };
        Mapbender.Manager.confirmDelete(null, null, labels, content).then(function() {
            $row.remove();
        });
    }).each(initPermissionRoot);

    // Element security
    function initElementSecurity(response, url) {
        var $content = $(response);
        // submit back to same url (would be automatic outside of popup scope)
        $content.filter('form').attr('action', url);

        var popup;
        var $initialView, $permissionsTable;
        var isModified = false;
        var popupOptions = {
            title: "Secure element",
            content: [$content],
            buttons: [
                {
                    // @todo: provide distinct label
                    label: Mapbender.trans('mb.actions.back'),
                    cssClass: 'button buttonReset hidden left',
                    callback: function() {
                        // reload entire popup
                        initElementSecurity(response, url);
                    }
                },
                {
                    label: Mapbender.trans('mb.actions.back'),
                    cssClass: 'button buttonBack hidden left',
                    callback: function() {
                        $('.contentItem', popup.$element).not($initialView).remove();
                        $initialView.removeClass('hidden');

                        $(".buttonAdd,.buttonBack,.buttonRemove", popup.$element).addClass('hidden');
                        $(".buttonOk", popup.$element).removeClass('hidden');
                        $('.buttonReset', popup.$element).toggleClass('hidden', !isModified);
                    }
                },
                {
                    label: Mapbender.trans('mb.actions.remove'),
                    cssClass: 'button buttonRemove hidden',
                    callback: function(evt) {
                        var $button = $(evt.currentTarget);
                        $('.contentItem', popup.$element).not($initialView).remove();
                        $initialView.removeClass('hidden');
                        $button.data('target-row').remove();
                        $button.data('target-row', null);
                        isModified = true;

                        $(".buttonAdd,.buttonRemove,.buttonBack", popup.$element).addClass('hidden');
                        $(".buttonOk,.buttonReset", popup.$element).removeClass('hidden');
                    }
                },
                {
                    label: Mapbender.trans('mb.actions.add'),
                    cssClass: 'button buttonAdd hidden',
                    callback: function() {
                        $(".contentItem:first", popup.$element).removeClass('hidden');
                        if ($(".contentItem", popup.$element).length > 1) {
                            appendAces($permissionsTable, $('#listFilterGroupsAndUsers', popup.$element), ['view']);
                            $(".contentItem:not(.contentItem:first)", popup.$element).remove();
                        }
                        isModified = true;
                        $(".buttonAdd,.buttonBack", popup.$element).addClass('hidden');
                        $(".buttonOk,.buttonReset", popup.$element).removeClass('hidden');
                    }
                },
                {
                    label: Mapbender.trans('mb.actions.save'),
                    cssClass: 'button buttonOk',
                    callback: function() {
                        $("form", popup.$element).submit();
                    }
                },
                {
                    label: Mapbender.trans('mb.actions.cancel'),
                    cssClass: 'button buttonCancel critical popupClose'
                }
            ]
        };
        popup = new Mapbender.Popup(popupOptions);
        $initialView = $(".contentItem:first", popup.$element);
        $permissionsTable = $('.permissionsTable', $initialView);
        $permissionsTable.each(initPermissionRoot);

        $('#addElmPermission', popup.$element).on('click', function(e) {
            var $anchor = $(this);
            var url = $anchor.attr('data-href') || $anchor.attr('href');
            e.preventDefault();
            e.stopPropagation();
            $.ajax({
                url: url,
                type: "GET",
                success: function(data) {
                    $(".contentItem:first,.buttonOk,.buttonReset", popup.$element).addClass('hidden');
                    $(".buttonAdd,.buttonBack", popup.$element).removeClass('hidden');
                    popup.addContent(filterSidContent(data, $permissionsTable));
                }
            });
            return false;
        });
        $permissionsTable.on("click", 'tbody .iconRemove', function() {
            var $row = $(this).closest('tr');
            var userGroup =($row.find(".iconUser").length ? "user " : "group ") + $row.find(".labelInput").text();
            popup.addContent(Mapbender.trans('mb.manager.components.popup.delete_user_group.content', {'userGroup': userGroup}));
            $(".contentItem:first,.buttonOk,.buttonReset", popup.$element).addClass('hidden');
            $('.buttonRemove', popup.$element).data('target-row', $row);
            $(".buttonRemove,.buttonBack", popup.$element).removeClass('hidden');
        });
    }

    $(".secureElement").on("click", function() {
        var url = $(this).attr('data-url');
        $.ajax({
            url: url
        }).then(function(response) {
            initElementSecurity(response, url);
        });
        return false;
    });
    $('.elementsTable').on('click', '.screentype-icon[data-screentype]', function() {
        var $target = $(this);
        var $group = $target.closest('.screentypes');
        var $other = $('.screentype-icon[data-screentype]', $group).not($target);
        var newScreenType;
        if (!$target.hasClass('disabled')) {
            newScreenType = $other.attr('data-screentype');
        } else {
            newScreenType = 'all';
        }
        $.ajax($group.attr('data-url'), {
            method: 'POST',
            data: {
                screenType: newScreenType
            }
        }).then(function() {
            $other.removeClass('disabled');
            $target.toggleClass('disabled');
        });
    });
});
