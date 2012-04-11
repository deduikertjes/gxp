/**
 * Copyright (c) 2008-2011 The Open Planning Project
 * 
 * Published under the GPL license.
 * See https://github.com/opengeo/gxp/raw/master/license.txt for the full text
 * of the license.
 */

//TODO remove the WMSStylesDialog and GeoServerStyleWriter includes
/**
 * @include widgets/WMSStylesDialog.js
 * @include plugins/GeoServerStyleWriter.js
 * @include GeoExt/widgets/LayerOpacitySlider.js
 */

/** api: (define)
 *  module = gxp
 *  class = WMSLayerPanel
 *  base_link = `Ext.TabPanel <http://extjs.com/deploy/dev/docs/?class=Ext.TabPanel>`_
 */
Ext.namespace("gxp");

/** api: constructor
 *  .. class:: WMSLayerPanel(config)
 *   
 *      Create a dialog for setting WMS layer properties like title, abstract,
 *      opacity, transparency and image format.
 */
gxp.WMSLayerPanel = Ext.extend(Ext.TabPanel, {
    
    /** api: config[layerRecord]
     *  ``GeoExt.data.LayerRecord``
     *  Show properties for this layer record.
     */
    layerRecord: null,

    /** api: config[source]
     *  ``gxp.plugins.LayerSource``
     *  Source for the layer. Optional. If not provided, ``sameOriginStyling``
     *  will be ignored.
     */
    source: null,
    
    /** api: config[styling]
     *  ``Boolean``
     *  Show a "Styles" tab. Default is true.
     */
    styling: true,
    
    /** api: config[sameOriginStyling]
     *  ``Boolean``
     *  Only allow editing of styles for layers whose sources have a URL that
     *  matches the origin of this application.  It is strongly discouraged to 
     *  do styling through the proxy as all authorization headers and cookies 
     *  are shared with all remotesources.  Default is ``true``.
     */
    sameOriginStyling: true,

    /** api: config[rasterStyling]
     *  ``Boolean`` If set to true, single-band raster styling will be
     *  supported.  Default is ``false``.
     */
    rasterStyling: false,

    /** private: property[transparent]
     *  ``Boolean``
     *  Used to store the previous state of the transparent checkbox before
     *  changing the image format to jpeg (and automagically changing
     *  the checkbox to disabled and unchecked).
     */
    transparent: null,
    
    /** private: property[editableStyles]
     *  ``Boolean``
     */
    editableStyles: false,
    
    /** api: config[activeTab]
     *  ``String or Number``
     *  A string id or the numeric index of the tab that should be initially
     *  activated on render.  Defaults to ``0``.
     */
    activeTab: 0,
    
    /** api: config[border]
     *  ``Boolean``
     *  Display a border around the panel.  Defaults to ``false``.
     */
    border: false,
    
    /** api: config[imageFormats]
     *  ``RegEx`` Regular expression used to test browser friendly formats for
     *  GetMap requests.  The formats displayed will those from the record that
     *  match this expression.  Default is ``/png|gif|jpe?g/i``.
     */
    imageFormats: /png|gif|jpe?g/i,
    
    /** i18n */
    aboutText: "About",
    titleText: "Title",
    nameText: "Name",
    descriptionText: "Description",
    displayText: "Display",
    opacityText: "Opacity",
    formatText: "Tile format",
    infoFormatText: "Info format",
    infoFormatEmptyText: "Select a format",
    transparentText: "Transparent",
    cacheText: "Caching",
    cacheFieldText: "Use cached tiles",
    stylesText: "Styles",
    displayOptionsText: "Display options",
    queryText: "Limit with filters",
    scaleText: "Limit by scale",
    minScaleText: "Min scale",
    maxScaleText: "Max scale",
 
    initComponent: function() {
        this.cqlFormat = new OpenLayers.Format.CQL();
        if (this.source) {
            this.source.getSchema(this.layerRecord, function(attributeStore) {
                if (attributeStore !== false) {
                    this.filterBuilder = new gxp.FilterBuilder({
                        allowGroups: false,
                        listeners: {
                            afterrender: function() {
                                this.filterBuilder.cascade(function(item) {
                                    if (item.getXType() === "toolbar") {
                                        item.addText('or ');
                                        item.addButton({
                                            text: 'use CQL filter instead',
                                            handler: this.switchToCQL,
                                            scope: this
                                        });
                                    }
                                }, this);
                            },
                            change: function(builder) {
                                var filter = builder.getFilter();
                                var cql = null;
                                if (filter !== false) {
                                    cql = this.cqlFormat.write(filter);
                                }
                                this.layerRecord.getLayer().mergeNewParams({
                                    CQL_FILTER: cql
                                });
                            },
                            scope: this
                        },
                        attributes: attributeStore
                    });
                    this.filterFieldset.add(this.filterBuilder);
                    this.filterFieldset.doLayout();
                }
            }, this);
        }
        this.addEvents(
            /** api: event[change]
             *  Fires when the ``layerRecord`` is changed using this dialog.
             */
            "change"
        );
        this.items = [
            this.createAboutPanel(),
            this.createDisplayPanel()
        ];

        // only add the Styles panel if we know for sure that we have styles
        if (this.styling && gxp.WMSStylesDialog && this.layerRecord.get("styles")) {
            // TODO: revisit this
            var url = this.layerRecord.get("restUrl");
            if (!url) {
                url = (this.source || this.layerRecord.get("layer")).url.split(
                    "?").shift().replace(/\/(wms|ows)\/?$/, "/rest");
            }
            if (this.sameOriginStyling) {
                // this could be made more robust
                // for now, only style for sources with relative url
                this.editableStyles = url.charAt(0) === "/";
            } else {
                this.editableStyles = true;
            }
            this.items.push(this.createStylesPanel(url));
        }

        gxp.WMSLayerPanel.superclass.initComponent.call(this);
    },

    switchToCQL: function() {
        var filter = this.filterBuilder.getFilter();
        var CQL = "";
        if (filter !== false) {
            CQL = this.cqlFormat.write(filter);
        }
        this.filterBuilder.hide();
        this.cqlField.setValue(CQL);
        this.cqlField.show();
        this.cqlToolbar.show();
    },

    switchToFilterBuilder: function() {
        var filter = null;
        // when parsing fails, we keep the previous filter in the filter builder
        try {
            filter = this.cqlFormat.read(this.cqlField.getValue());
        } catch(e) {
        }
        this.cqlField.hide();
        this.cqlToolbar.hide();
        this.filterBuilder.show();
        if (filter !== null) {
            this.filterBuilder.setFilter(filter);
        }
    },

    /** private: createStylesPanel
     *  :arg url: ``String`` url to save styles to
     *
     *  Creates the Styles panel.
     */
    createStylesPanel: function(url) {
        var config = gxp.WMSStylesDialog.createGeoServerStylerConfig(
            this.layerRecord, url
        );
        if (this.rasterStyling === true) {
            config.plugins.push({
                ptype: "gxp_wmsrasterstylesdialog"
            });
        }
        return Ext.apply(config, {
            title: this.stylesText,
            style: "padding: 10px",
            editable: false,
            listeners: Ext.apply(config.listeners, {
                "beforerender": {
                    fn: function(cmp) {
                        var render = !this.editableStyles;
                        if (!render) {
                            if (typeof this.authorized == 'boolean') {
                                cmp.editable = this.authorized;
                                cmp.ownerCt.doLayout();
                            } else {
                                Ext.Ajax.request({
                                    method: "PUT",
                                    url: url + "/styles",
                                    callback: function(options, success, response) {
                                        // we expect a 405 error code here if we are dealing with
                                        // GeoServer and have write access. Otherwise we will
                                        // create the panel in readonly mode.
                                        cmp.editable = (response.status == 405);
                                        cmp.ownerCt.doLayout();
                                    }
                                });
                            }
                        }
                        return render;
                    },
                    scope: this,
                    single: true
                }
            })
        });
    },
    
    /** private: createAboutPanel
     *  Creates the about panel.
     */
    createAboutPanel: function() {
        return {
            title: this.aboutText,
            style: {"padding": "10px"},
            defaults: {
                border: false
            },
            items: [{
                layout: "form",
                labelWidth: 70,
                items: [{
                    xtype: "textfield",
                    fieldLabel: this.titleText,
                    anchor: "99%",
                    value: this.layerRecord.get("title"),
                    listeners: {
                        change: function(field) {
                            this.layerRecord.set("title", field.getValue());
                            //TODO revisit when discussion on
                            // http://trac.geoext.org/ticket/110 is complete
                            this.layerRecord.commit();
                            this.fireEvent("change");
                        },
                        scope: this
                    }
                }, {
                    xtype: "textfield",
                    fieldLabel: this.nameText,
                    anchor: "99%",
                    value: this.layerRecord.get("name"),
                    readOnly: true
                }]
            }, {
                layout: "form",
                labelAlign: "top",
                items: [{
                    xtype: "textarea",
                    fieldLabel: this.descriptionText,
                    grow: true,
                    growMax: 150,
                    anchor: "99%",
                    value: this.layerRecord.get("abstract"),
                    readOnly: true
                }]
            }]
        };
    },

    /** private: onFormatChange
     *  Handler for when the image format is changed.
     */
    onFormatChange: function(combo) {
        var layer = this.layerRecord.getLayer();
        var format = combo.getValue();
        layer.mergeNewParams({
            format: format
        });
        var cb = this.transparentCb;
        if (format == "image/jpeg") {
            this.transparent = cb.getValue();
            cb.setValue(false);
        } else if (this.transparent !== null) {
            cb.setValue(this.transparent);
            this.transparent = null;
        }
        cb.setDisabled(format == "image/jpeg");
        this.fireEvent("change");
    },

    addScaleOptions: function(layer, options) {
        // work around some weird OpenLayers issues for now:
        // 1. inRange not updated if alwaysInRange is not equal to null
        // 2. redraw does not hide if out of scale, so use display and 
        //    calculateInRange instead
        layer.alwaysInRange = null;
        layer.addOptions(options);
        layer.display(layer.calculateInRange());
        // however this also seems to cause side-effects: layer out of sync with basemap
    },
    
    /** private: createDisplayPanel
     *  Creates the display panel.
     */
    createDisplayPanel: function() {
        var record = this.layerRecord;
        var layer = record.getLayer();
        var opacity = layer.opacity;
        if(opacity == null) {
            opacity = 1;
        }
        var formats = [];
        var currentFormat = layer.params["FORMAT"].toLowerCase();
        Ext.each(record.get("formats"), function(format) {
            if(this.imageFormats.test(format)) {
                formats.push(format.toLowerCase());
            }
        }, this);
        if(formats.indexOf(currentFormat) === -1) {
            formats.push(currentFormat);
        }
        var transparent = layer.params["TRANSPARENT"];
        transparent = (transparent === "true" || transparent === true);

        return {
            title: this.displayText,
            layout: 'form',
            style: {"padding": "10px"},
            defaults: {
                labelWidth: 70
            },
            items: [{
                xtype: "fieldset",
                title: this.displayOptionsText,
                items: [{
                    xtype: "gx_opacityslider",
                    name: "opacity",
                    anchor: "99%",
                    isFormField: true,
                    fieldLabel: this.opacityText,
                    listeners: {
                        change: function() {
                            this.fireEvent("change");
                        },
                        scope: this
                    },
                    layer: this.layerRecord
                }, {
                    xtype: "compositefield",
                    fieldLabel: this.formatText,
                    anchor: "99%",
                    items: [{
                        xtype: "combo",
                        width: 90,
                        listWidth: 150,
                        store: formats,
                        value: currentFormat,
                        mode: "local",
                        triggerAction: "all",
                        editable: false,
                        listeners: {
                            select: this.onFormatChange,
                            scope: this
                        }
                    }, {
                        xtype: "checkbox",
                        ref: '../../../transparentCb',
                        checked: transparent,
                        listeners: {
                            check: function(checkbox, checked) {
                                layer.mergeNewParams({
                                    transparent: checked ? "true" : "false"
                                });
                                 this.fireEvent("change");
                            },
                            scope: this
                        }
                    }, {
                        xtype: "label",
                        cls: "gxp-layerproperties-label",
                        text: this.transparentText
                    }]
                }, {
                    xtype: "compositefield",
                    anchor: "99%",
                    hidden: this.layerRecord.get("layer").params.TILED == null,
                    fieldLabel: this.cacheText,
                    items: [{
                        xtype: "checkbox",
                        checked: (this.layerRecord.get("layer").params.TILED === true),
                        listeners: {
                            check: function(checkbox, checked) {
                                var layer = this.layerRecord.get("layer");
                                layer.mergeNewParams({
                                    TILED: checked
                                });
                                this.fireEvent("change");
                            },
                            scope: this
                        }
                    }, {
                        xtype: "label",
                        cls: "gxp-layerproperties-label",
                        text: this.cacheFieldText
                    }]
                }, {
                    xtype: "combo",
                    fieldLabel: this.infoFormatText,
                    emptyText: this.infoFormatEmptyText,
                    store: record.get("infoFormats"),
                    value: record.get("infoFormat"),
                    hidden: (record.get("infoFormats") === undefined),
                    mode: 'local',
                    listWidth: 150,
                    triggerAction: "all",
                    editable: false,
                    anchor: "99%", 
                    listeners: {
                        select: function(combo) {
                            var infoFormat = combo.getValue();
                            record.set("infoFormat", infoFormat);
                            this.fireEvent("change");
                        }
                    }, 
                    scope: this
                }]
            }, {
                xtype: "fieldset",
                title: this.queryText,
                hideLabels: true,
                ref: "../filterFieldset",
                listeners: {
                    expand: function() {
                        this.layerRecord.getLayer().mergeNewParams({CQL_FILTER: this.cqlFilter});
                    },
                    collapse: function() {
                        this.cqlFilter = this.layerRecord.getLayer().params.CQL_FILTER;
                        this.layerRecord.getLayer().mergeNewParams({CQL_FILTER: null});
                    },
                    scope: this
                },
                hidden: this.source === null,
                checkboxToggle: true,
                items: [{
                    xtype: "textarea",
                    grow: true,
                    anchor: '99%',
                    width: '100%',
                    growMax: 100,
                    ref: "../../cqlField",
                    hidden: true
                }, {
                    xtype: 'toolbar',
                    ref: "../../cqlToolbar",
                    hidden: true,
                    items: [{
                        text: "Switch back to filter builder",
                        handler: this.switchToFilterBuilder,
                        scope: this
                    }]
                }]
            }, {
                xtype: "fieldset",
                title: this.scaleText,
                listeners: {
                    expand: function() {
                        var layer = this.layerRecord.getLayer();
                        if (this.minScale !== undefined || this.maxScale !== undefined) {
                            this.addScaleOptions(layer, {minScale: this.maxScale, maxScale: this.minScale});
                        }
                    },
                    collapse: function() {
                        var layer = this.layerRecord.getLayer();
                        this.minScale = layer.options.maxScale;
                        this.maxScale = layer.options.minScale;
                        this.addScaleOptions(layer, {minScale: null, maxScale: null});
                    },
                    scope: this
                },
                checkboxToggle: true,
                items: [{
                    xtype: "compositefield",
                    fieldLabel: this.minScaleText,
                    anchor: '99%',
                    width: '100%',
                    items: [{
                        xtype: "label",
                        text: "1:",
                        cls: "gxp-layerproperties-label"
                    }, {
                        xtype: "numberfield",
                        listeners: {
                            'change': function(field) {
                                var options = {
                                    maxScale: parseInt(field.getValue())
                                };
                                var layer = this.layerRecord.getLayer();
                                this.addScaleOptions(layer, options);
                            },
                            scope: this
                        },
                        value: this.layerRecord.getLayer().options.maxScale
                    }]
                }, {
                    xtype: "compositefield",
                    fieldLabel: this.maxScaleText,
                    anchor: '99%',
                    width: '100%',
                    items: [{
                        xtype: "label",
                        text: "1:",
                        cls: "gxp-layerproperties-label"
                    }, {
                        xtype: "numberfield",
                        listeners: {
                            'change': function(field) {
                                var options = {
                                    minScale: parseInt(field.getValue())
                                };
                                var layer = this.layerRecord.getLayer();
                                this.addScaleOptions(layer, options);
                            },
                            scope: this
                        },
                        value: this.layerRecord.getLayer().options.minScale
                    }]
                }]
            }]
        };
    }    

});

Ext.reg('gxp_wmslayerpanel', gxp.WMSLayerPanel); 
