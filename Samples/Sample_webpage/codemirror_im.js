/*
 * INTER-Mediator Ver.@@@@2@@@@ Released @@@@1@@@@
 *
 *   by Masayuki Nii  msyk@msyk.net Copyright (c) 2014 Masayuki Nii, All rights reserved.
 *
 *   This project started at the end of 2009.
 *   INTER-Mediator is supplied under MIT License.
 */

IMParts_Catalog["codemirror"] = {
    instanciate: function (parentNode) {
        var newId = parentNode.getAttribute('id') + '-e';
        var newNode = document.createElement('TEXTAREA');
        newNode.setAttribute('id', newId);
        INTERMediatorLib.setClassAttributeToNode(newNode, '_im_codemirror');
        parentNode.appendChild(newNode);
        this.ids.push(newId);

        newNode._im_getValue = function () {
            var targetNode = newNode;
            return targetNode.getValue();
        };
        parentNode._im_getValue = function () {
            var targetNode = newNode;
            return targetNode.value;
        };
        parentNode._im_getComponentId = function () {
            var theId = newId;
            return theId;
        };

        parentNode._im_setValue = function (str) {
            var theId = newId;
            IMParts_codemirror.initialValues[theId] = str;
        };
    },
    ids: [],
    initialValues: {},
    mode: "text/html",
    finish: function () {
        for (var i = 0; i < this.ids.length; i++) {
            var targetId = this.ids[i];
            var targetNode = document.getElementById(targetId);
            if (targetNode) {
                var editor = CodeMirror.fromTextArea(targetNode, {mode: this.mode});
                editor.setValue(this.initialValues[targetId]);
                editor.on("change", function () {
                    var nodeId = targetId;
                    return function (instance, obj) {
                        INTERMediator.valueChange(nodeId)
                    };
                }());
                targetNode._im_getValue = function () {
                    var insideEditor = editor;
                    return function () {
                        return insideEditor.getValue();
                    }
                }();
                targetNode.parentNode._im_getValue = function () {
                    var insideEditor = editor;
                    return function () {
                        return insideEditor.getValue();
                    }
                }();
            }
        }
        this.ids = [];
        this.initialValues = {};
    }
};
