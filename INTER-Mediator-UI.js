/*
 * INTER-Mediator
 * Copyright (c) INTER-Mediator Directive Committee (http://inter-mediator.org)
 * This project started at the end of 2009 by Masayuki Nii msyk@msyk.net.
 *
 * INTER-Mediator is supplied under MIT License.
 * Please see the full license for details:
 * https://github.com/INTER-Mediator/INTER-Mediator/blob/master/dist-docs/License.txt
 */

// JSHint support
/* global IMLibContextPool, INTERMediator, INTERMediatorOnPage, IMLibMouseEventDispatch, IMLibLocalContext,
 IMLibChangeEventDispatch, INTERMediatorLib, INTERMediator_DBAdapter, IMLibQueue, IMLibCalc, IMLibPageNavigation,
 IMLibEventResponder, IMLibElement, Parser, IMLib, INTERMediatorLog */
/* jshint -W083 */ // Function within a loop

/**
 * @fileoverview IMLibUI class is defined here.
 */
/**
 *
 * Usually you don't have to instanciate this class with new operator.
 * @constructor
 */
var IMLibUI = {

    mobileSelectionColor: '#BBBBBB',
    mobileNaviBackButtonId: null,
    mergedFieldSeparator: '\n',

    /*
     valueChange
     Parameters: It the validationOnly parameter is set to true, this method should return the boolean value
     if validation is succeed or not.
     */
    valueChange: function (idValue, validationOnly) {
        'use strict';
        var changedObj, contextInfo, linkInfo, nodeInfo, returnValue = true;

        changedObj = document.getElementById(idValue);
        if (!changedObj) {
            return false;
        }
        if (changedObj.readOnly) {  // for Internet Explorer
            return true;
        }
        // Validating
        if (!IMLibUI.validation(changedObj)) {  // Validation error.
            changedObj.focus();
            linkInfo = INTERMediatorLib.getLinkedElementInfo(changedObj);
            nodeInfo = INTERMediatorLib.getNodeInfoArray(linkInfo[0]);  // Suppose to be the first definition.
            contextInfo = IMLibContextPool.getContextInfoFromId(idValue, nodeInfo.target);
            window.setTimeout((function () {
                var originalObj = changedObj;
                var originalContextInfo = contextInfo;
                return function () {
                    if (originalContextInfo) {
                        originalObj.value = originalContextInfo.context.getValue(
                            originalContextInfo.record, originalContextInfo.field);
                    }
                    originalObj.removeAttribute('data-im-validation-notification');
                };
            })(), 0);
            return false;
        }
        if (validationOnly === true) {
            return true;
        }

        IMLibQueue.setTask(function (completeTask) {
            returnValue = valueChangeImpl(idValue, completeTask);
        });
        return returnValue;

        // After validating, update nodes and database.
        function valueChangeImpl(idValue, completeTask) {
            var changedObj, objType, i, newValue, result, linkInfo, nodeInfo, contextInfo, parentContext,
                targetField, targetNode, targetSpec, returnValue = true;
            try {
                changedObj = document.getElementById(idValue);
                linkInfo = INTERMediatorLib.getLinkedElementInfo(changedObj);
                nodeInfo = INTERMediatorLib.getNodeInfoArray(linkInfo[0]);  // Suppose to be the first definition.
                contextInfo = IMLibContextPool.getContextInfoFromId(idValue, nodeInfo.target);
                if (!contextInfo) { // In case of local context
                    targetNode = document.getElementById(idValue);
                    targetSpec = targetNode.getAttribute('data-im');
                    if (targetSpec && targetSpec.split(INTERMediator.separator)[0] === IMLibLocalContext.contextName) {
                        IMLibLocalContext.updateFromNodeValue(idValue);
                        IMLibCalc.recalculation();
                        completeTask();
                        return true;
                    }
                    throw 'unfinished';
                }

                objType = changedObj.getAttribute('type');
                if (objType === 'radio' && !changedObj.checked) {
                    completeTask();
                    return true;
                }

                if (!contextInfo) {
                    throw 'unfinished';
                }
                newValue = IMLibElement.getValueFromIMNode(changedObj);
                parentContext = contextInfo.context.parentContext;
                if (parentContext) {
                    result = parentContext.isValueUndefined(
                        Object.keys(parentContext.store)[0], contextInfo.field, contextInfo.record);
                } else {
                    result = contextInfo.context.isValueUndefined(contextInfo.record, contextInfo.field, false);
                }
                if (result) {
                    INTERMediatorLog.setErrorMessage('Error in updating.',
                        INTERMediatorLib.getInsertedString(
                            INTERMediatorOnPage.getMessages()[1040],
                            [contextInfo.context.contextName, contextInfo.field]));
                    throw 'unfinished';
                }
                if (INTERMediatorOnPage.getOptionsTransaction() === 'none') {
                    // Just supporting NON-target info.
                    contextInfo.context.setValue(contextInfo.record, contextInfo.field, newValue);
                    contextInfo.context.setModified(contextInfo.record, contextInfo.field, newValue);
                    throw 'unfinished';
                }
                INTERMediatorOnPage.showProgress();
                contextInfo.context.updateFieldValue(
                    idValue,
                    (function () {
                        var idValueCapt2 = idValue;
                        var contextInfoCapt = contextInfo;
                        var newValueCapt = newValue;
                        var completeTaskCapt = completeTask;
                        return function (result) {
                            var updateRequiredContext, currentValue, associatedNode, field, node, children, delNodes,
                                recordObj, keepProp;
                            var keyField = contextInfoCapt.context.getKeyField();
                            if (result && result.dbresult) {
                                recordObj = result.dbresult[0];
                                keepProp = INTERMediator.partialConstructing;
                                INTERMediator.partialConstructing = false;
                                for (field in recordObj) {
                                    if (recordObj.hasOwnProperty(field)) {
                                        contextInfoCapt.context.setValue(
                                            keyField + '=' + recordObj[keyField], field, recordObj[field]);
                                    }
                                }
                            }
                            INTERMediator.partialConstructing = keepProp;
                            updateRequiredContext = IMLibContextPool.dependingObjects(idValueCapt2);
                            for (i = 0; i < updateRequiredContext.length; i++) {
                                updateRequiredContext[i].foreignValue = {};
                                updateRequiredContext[i].foreignValue[contextInfoCapt.field] = newValueCapt;
                                if (updateRequiredContext[i]) {
                                    INTERMediator.constructMain(updateRequiredContext[i]);
                                    associatedNode = updateRequiredContext[i].enclosureNode;
                                    if (INTERMediatorLib.isPopupMenu(associatedNode)) {
                                        currentValue = contextInfo.context.getContextValue(associatedNode.id, '');
                                        IMLibElement.setValueToIMNode(associatedNode, '', currentValue, false);
                                    }
                                }
                            }
                            node = document.getElementById(idValueCapt2);
                            if (node && node.tagName === 'SELECT') {
                                children = node.childNodes;
                                for (i = 0; i < children.length; i++) {
                                    if (children[i].nodeType === 1) {
                                        if (children[i].tagName === 'OPTION' &&
                                            children[i].getAttribute('data-im-element') === 'auto-generated') {
                                            delNodes = [];
                                            delNodes.push(children[i].getAttribute('id'));
                                            IMLibElement.deleteNodes(delNodes);
                                        }
                                    }
                                }
                            }
                            IMLibCalc.recalculation();//IMLibCalc.recalculation(idValueCapt2); // Optimization Required
                            INTERMediatorOnPage.hideProgress();
                            INTERMediatorLog.flushMessage();
                            if (completeTaskCapt) {
                                completeTaskCapt();
                            }
                        };
                    })(),
                    (function () {
                        var targetFieldCapt = targetField;
                        var completeTaskCapt = completeTask;
                        return function () {
                            window.alert(INTERMediatorLib.getInsertedString(
                                INTERMediatorOnPage.getMessages()[1003], [targetFieldCapt]));
                            INTERMediatorOnPage.hideProgress();
                            if (completeTaskCapt) {
                                completeTaskCapt();
                            }
                        };
                    })(),
                    function () {
                        var response = window.confirm(INTERMediatorOnPage.getMessages()[1024]);
                        if (!response) {
                            INTERMediatorOnPage.hideProgress();
                        }
                        if (completeTask) {
                            completeTask();
                        }
                        return response;
                    },
                    (function () {
                        var changedObjectCapt = changedObj;
                        var completeTaskCapt = completeTask;
                        return function (initialvalue, newValue, currentFieldVal) {
                            if (completeTaskCapt) {
                                completeTaskCapt();
                            }
                            if (!window.confirm(INTERMediatorLib.getInsertedString(
                                    INTERMediatorOnPage.getMessages()[1001], [initialvalue, newValue, currentFieldVal]))) {
                                window.setTimeout(function () {
                                    changedObjectCapt.focus();
                                }, 0);

                                INTERMediatorOnPage.hideProgress();
                                return false;
                            }
                            return true;
                        };
                    })()
                );
            } catch (e) {
                if (completeTask) {
                    completeTask();
                }
                returnValue = false;
            }
            return returnValue;
        }
    },

    validation: function (changedObj) {
        'use strict';
        var linkInfo, matched, context, i, index, didValidate, contextInfo,
            result, messageNodes = [], messageNode;
        if (messageNodes) {
            while (messageNodes.length > 0) {
                messageNodes[0].parentNode.removeChild(messageNodes[0]);
                delete messageNodes[0];
            }
        }
        if (!messageNodes) {
            messageNodes = [];
        }
        try {
            linkInfo = INTERMediatorLib.getLinkedElementInfo(changedObj);
            didValidate = false;
            result = true;
            if (linkInfo.length > 0) {
                matched = linkInfo[0].match(/([^@]+)/);
                if (matched[1] !== IMLibLocalContext.contextName) {
                    context = INTERMediatorLib.getNamedObject(
                        INTERMediatorOnPage.getDataSources(), 'name', matched[1]);
                    if (context && context.validation) {
                        for (i = 0; i < linkInfo.length; i++) {
                            matched = linkInfo[i].match(/([^@]+)@([^@]+)/);
                            for (index in context.validation) {
                                if (context.validation[index].field === matched[2]) {
                                    didValidate = true;
                                    result = Parser.evaluate(
                                        context.validation[index].rule,
                                        {'value': changedObj.value, 'target': changedObj});
                                    if (!result) {
                                        switch (context.validation[index].notify) {
                                        case 'inline':
                                            INTERMediatorLib.clearErrorMessage(changedObj);
                                            messageNode = INTERMediatorLib.createErrorMessageNode(
                                                'SPAN', context.validation[index].message);
                                            changedObj.parentNode.insertBefore(
                                                messageNode, changedObj.nextSibling);
                                            messageNodes.push(messageNode);
                                            break;
                                        case 'end-of-sibling':
                                            INTERMediatorLib.clearErrorMessage(changedObj);
                                            messageNode = INTERMediatorLib.createErrorMessageNode(
                                                'DIV', context.validation[index].message);
                                            changedObj.parentNode.appendChild(messageNode);
                                            messageNodes.push(messageNode);
                                            break;
                                        default:
                                            if (changedObj.getAttribute('data-im-validation-notification') !== 'alert') {
                                                window.alert(context.validation[index].message);
                                                changedObj.setAttribute('data-im-validation-notification', 'alert');
                                            }
                                            break;
                                        }
                                        contextInfo = IMLibContextPool.getContextInfoFromId(changedObj, '');
                                        if (contextInfo) {                                        // Just supporting NON-target info.
                                            changedObj.value = contextInfo.context.getValue(
                                                contextInfo.record, contextInfo.field);
                                            window.setTimeout(function () {
                                                changedObj.focus();
                                            }, 0);
                                            if (INTERMediatorOnPage.doAfterValidationFailure !== null) {
                                                INTERMediatorOnPage.doAfterValidationFailure(changedObj, linkInfo[i]);
                                            }
                                        }
                                        return result;
                                    } else {
                                        switch (context.validation[index].notify) {
                                        case 'inline':
                                        case 'end-of-sibling':
                                            INTERMediatorLib.clearErrorMessage(changedObj);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (didValidate) {
                    if (INTERMediatorOnPage.doAfterValidationSucceed) {
                        result = INTERMediatorOnPage.doAfterValidationSucceed(changedObj, linkInfo[i]);
                    }
                }
            }
            return result;
        } catch (ex) {
            if (ex === '_im_requath_request_') {
                throw ex;
            } else {
                INTERMediatorLog.setErrorMessage(ex, 'EXCEPTION-32: on the validation process.');
            }
            return false;
        }
    },

    copyButton: function (contextObj, keyValue) {
        'use strict';
        var contextDef = contextObj.getContextDef();
        if (contextDef['repeat-control'].match(/confirm-copy/)) {
            if (!window.confirm(INTERMediatorOnPage.getMessages()[1041])) {
                return;
            }
        }
        IMLibQueue.setTask((function () {
            var contextObjCapt = contextObj;
            var keyValueCapt = keyValue;
            return function (completeTask) {
                var contextDef, assocDef, i, index, def, assocContexts, pStart, copyTerm;
                contextDef = contextObjCapt.getContextDef();
                INTERMediatorOnPage.showProgress();
                try {
                    if (contextDef.relation) {
                        for (index in contextDef.relation) {
                            if (contextDef.relation[index].portal === true) {
                                contextDef.portal = true;
                            }
                        }
                    }

                    assocDef = [];
                    if (contextDef['repeat-control'].match(/copy-/)) {
                        pStart = contextDef['repeat-control'].indexOf('copy-');
                        copyTerm = contextDef['repeat-control'].substr(pStart + 5);
                        if ((pStart = copyTerm.search(/\s/)) > -1) {
                            copyTerm = copyTerm.substr(0, pStart);
                        }
                        assocContexts = copyTerm.split(',');
                        for (i = 0; i < assocContexts.length; i++) {
                            def = IMLibContextPool.getContextDef(assocContexts[i]);
                            if (def.relation[0]['foreign-key']) {
                                assocDef.push({
                                    name: def.name,
                                    field: def.relation[0]['foreign-key'],
                                    value: keyValueCapt
                                });
                            }
                        }
                    }

                    INTERMediatorOnPage.retrieveAuthInfo();
                    INTERMediator_DBAdapter.db_copy_async(
                        {
                            name: contextDef.name,
                            conditions: [{field: contextDef.key, operator: '=', value: keyValueCapt}],
                            associated: assocDef.length > 0 ? assocDef : null
                        },
                        (function () {
                            var contextDefCapt = contextDef;
                            var contextObjCapt2 = contextObjCapt;
                            var completeTaskCapt = completeTask;
                            return function (result) {
                                var restore, conditions, sameOriginContexts;
                                var newId = result.newRecordKeyValue;
                                if (newId > -1) {
                                    restore = INTERMediator.additionalCondition;
                                    INTERMediator.startFrom = 0;
                                    if (contextDefCapt.records <= 1) {
                                        conditions = INTERMediator.additionalCondition;
                                        conditions[contextDefCapt.name] = {field: contextDefCapt.key, value: newId};
                                        INTERMediator.additionalCondition = conditions;
                                        IMLibLocalContext.archive();
                                    }
                                    INTERMediator_DBAdapter.unregister();
                                    INTERMediator.constructMain(contextObjCapt2);
                                    sameOriginContexts = IMLibContextPool.getContextsWithSameOrigin(contextObjCapt2);
                                    for (i = 0; i < sameOriginContexts.length; i++) {
                                        INTERMediator.constructMain(sameOriginContexts[i], null);
                                    }
                                    INTERMediator.additionalCondition = restore;
                                }
                                IMLibCalc.recalculation();
                                INTERMediatorOnPage.hideProgress();
                                // IMLibUI.unlockUIElement(contextDefCapt.name);
                                completeTaskCapt();
                                INTERMediatorLog.flushMessage();
                            };
                        })(),
                        completeTask
                    );
                } catch (ex) {
                    INTERMediatorLog.setErrorMessage(ex, 'EXCEPTION-43');
                    // IMLibUI.unlockUIElement(idValue);
                }
            };
        })());
    },

    deleteButton: function (currentContext, keyField, keyValue, isConfirm) {
        'use strict';
        var dialogMessage;
        if (isConfirm) {
            dialogMessage = INTERMediatorOnPage.getMessages()[1025];
            if (!window.confirm(dialogMessage)) {
                return;
            }
        }
        IMLibQueue.setTask((function () {
            var currentContextCapt = currentContext;
            var keyFieldCapt = keyField;
            var keyValueCapt = keyValue;
            return function (completeTask) {
                var i, parentKeyValue, deleteSuccessProc, targetRepeaters;
                INTERMediatorOnPage.showProgress();
                try {
                    INTERMediatorOnPage.retrieveAuthInfo();
                    deleteSuccessProc = (function () {
                        var currentContextCapt2 = currentContextCapt;
                        var completeTaskCapt = completeTask;
                        var keying = keyFieldCapt + '=' + keyValueCapt;
                        return function () {
                            if (currentContextCapt2.relation === true) {
                                INTERMediator.pagedAllCount--;
                                if (INTERMediator.pagedAllCount - INTERMediator.startFrom < 1) {
                                    INTERMediator.startFrom = INTERMediator.startFrom - INTERMediator.pagedSize;
                                    if (INTERMediator.startFrom < 0) {
                                        INTERMediator.startFrom = 0;
                                    }
                                }
                                if (INTERMediator.pagedAllCount >= INTERMediator.pagedSize) {
                                    INTERMediator.construct();
                                }
                            }
                            IMLibPageNavigation.navigationSetup();
                            targetRepeaters = currentContextCapt2.binding[keying]._im_repeater;
                            for (i = 0; i < targetRepeaters.length; i++) {
                                IMLibContextPool.removeRecordFromPool(targetRepeaters[i].id);
                            }
                            IMLibCalc.recalculation();
                            INTERMediatorOnPage.hideProgress();
                            completeTaskCapt();
                            INTERMediatorLog.flushMessage();
                        };
                    })();

                    if (currentContextCapt.isPortal) {
                        parentKeyValue = currentContextCapt.potalContainingRecordKV.split('=');
                        INTERMediator_DBAdapter.db_update_async(
                            {
                                name: currentContextCapt.parentContext.contextName,
                                conditions: [
                                    {field: parentKeyValue[0], operator: '=', value: parentKeyValue[1]}
                                ],
                                dataset: [
                                    {
                                        field: '-delete.related',
                                        operator: '=',
                                        value: currentContextCapt.contextName + '.' + keyValue
                                    }
                                ]
                            },
                            deleteSuccessProc,
                            completeTask);
                    } else {
                        INTERMediator_DBAdapter.db_delete_async(
                            {
                                name: currentContextCapt.contextName,
                                conditions: [{field: keyFieldCapt, operator: '=', value: keyValueCapt}]
                            },
                            deleteSuccessProc,
                            function () {
                                INTERMediatorLog.setErrorMessage('Delete Error', 'EXCEPTION-46');
                                completeTask();
                            }
                        );
                    }

                } catch (ex) {
                    if (ex.message === '_im_requath_request_') {
                        if (INTERMediatorOnPage.requireAuthentication && !INTERMediatorOnPage.isComplementAuthData()) {
                            INTERMediatorOnPage.clearCredentials();
                            INTERMediatorOnPage.authenticating(
                                function () {
                                    IMLibUI.deleteButton(
                                        currentContextCapt, keyFieldCapt, keyValueCapt, false);
                                }
                            );
                            return;
                        }
                    } else {
                        INTERMediatorLog.setErrorMessage(ex, 'EXCEPTION-3');
                    }
                    completeTask();
                }
            };
        })());
    },

    insertButton: function (currentObj, keyValue, foreignValues, updateNodes, isConfirm) {
        'use strict';
        if (isConfirm) {
            if (!window.confirm(INTERMediatorOnPage.getMessages()[1026])) {
                return;
            }
        }
        IMLibQueue.setTask((function () {
            var currentContext, targetName, isPortal, parentContextName;
            var keyValueCapt = keyValue;
            var foreignValuesCapt = foreignValues;
            var updateNodesCapt = updateNodes;

            targetName = currentObj.contextName;
            currentContext = currentObj.getContextDef();
            isPortal = currentObj.isPortal;
            parentContextName = currentObj.parentContext ? currentObj.parentContext.contextName : null;
            return function (completeTask) {
                var targetRecord, portalField, recordSet, index, targetPortalField, targetPortalValue,
                    existRelated = false,
                    relatedRecordSet;

                INTERMediatorOnPage.showProgress();
                recordSet = [];
                relatedRecordSet = [];
                if (foreignValuesCapt) {
                    for (index in currentContext.relation) {
                        if (currentContext.relation.hasOwnProperty(index)) {
                            recordSet.push({
                                field: currentContext.relation[index]['foreign-key'],
                                value: foreignValuesCapt[currentContext.relation[index]['join-field']]
                            });
                        }
                    }
                }
                INTERMediatorOnPage.retrieveAuthInfo();
                if (isPortal) {
                    relatedRecordSet = [];
                    for (index in currentContext['default-values']) {
                        if (currentContext['default-values'].hasOwnProperty(index)) {
                            relatedRecordSet.push({
                                field: targetName + '::' + currentContext['default-values'][index].field + '.0',
                                value: currentContext['default-values'][index].value
                            });
                        }
                    }

                    if (relatedRecordSet.length === 0) {
                        targetPortalValue = '';
                        targetRecord = INTERMediator_DBAdapter.db_query(
                            {
                                name: targetName,
                                records: 1,
                                conditions: [
                                    {
                                        field: currentContext.key ? currentContext.key : INTERMediatorOnPage.defaultKeyName,
                                        operator: '=',
                                        value: keyValueCapt
                                    }
                                ]
                            }
                        );
                        for (portalField in targetRecord.recordset[0][0]) {
                            if (portalField.indexOf(targetName + '::') > -1 && portalField !== targetName + '::' + INTERMediatorOnPage.defaultKeyName) {
                                existRelated = true;
                                targetPortalField = portalField;
                                if (portalField === targetName + '::' + recordSet[0].field) {
                                    targetPortalValue = recordSet[0].value;
                                    break;
                                }
                                if (portalField !== targetName + '::id' &&
                                    portalField !== targetName + '::' + recordSet[0].field) {
                                    break;
                                }
                            }
                        }

                        if (existRelated === false) {
                            targetRecord = INTERMediator_DBAdapter.db_query(
                                {
                                    name: targetName,
                                    records: 0,
                                    conditions: [
                                        {
                                            field: currentContext.key ? currentContext.key : INTERMediatorOnPage.defaultKeyName,
                                            operator: '=',
                                            value: keyValueCapt
                                        }
                                    ]
                                }
                            );
                            for (portalField in targetRecord.recordset) {
                                if (portalField.indexOf(targetName + '::') > -1 && portalField !== targetName + '::' + INTERMediatorOnPage.defaultKeyName) {
                                    targetPortalField = portalField;
                                    if (portalField === targetName + '::' + recordSet[0].field) {
                                        targetPortalValue = recordSet[0].value;
                                        break;
                                    }
                                    if (portalField !== targetName + '::id' &&
                                        portalField !== targetName + '::' + recordSet[0].field) {
                                        break;
                                    }
                                }
                            }
                        }
                        relatedRecordSet.push({field: targetPortalField + '.0', value: targetPortalValue});
                    }

                    completeTask();
                    //IMLibUI.unlockUIElement(idValue);
                    if (currentContext.relation && currentContext.relation[0] &&
                        currentContext.relation[0]['join-field']) {
                        INTERMediator_DBAdapter.db_update({
                            name: parentContextName,
                            conditions: [{
                                field: currentContext.relation[0]['join-field'],
                                operator: '=',
                                value: foreignValuesCapt.id
                            }],
                            dataset: relatedRecordSet
                        });
                        INTERMediator.constructMain();
                    } else {
                        INTERMediatorLog.setErrorMessage('Insert Error (Portal Access Mode)', 'EXCEPTION-4');
                    }
                } else {
                    INTERMediator_DBAdapter.db_createRecord_async(
                        {name: targetName, dataset: recordSet},
                        (function () {
                            var targetNameCapt = targetName;
                            var currentContextCapt = currentContext;
                            var updateNodesCapt2 = updateNodesCapt;
                            var foreignValuesCapt2 = foreignValuesCapt;
                            var existRelatedCapt = existRelated;
                            var keyValueCapt2 = keyValueCapt;
                            return function (result) {
                                var keyField, newRecordId, associatedContext, conditions, createdRecord,
                                    i, sameOriginContexts;
                                newRecordId = result.newRecordKeyValue;
                                keyField = currentContextCapt.key ? currentContextCapt.key : INTERMediatorOnPage.defaultKeyName;
                                associatedContext = IMLibContextPool.contextFromEnclosureId(updateNodesCapt2);
                                completeTask();
                                if (associatedContext) {
                                    associatedContext.foreignValue = foreignValuesCapt2;
                                    if (currentContextCapt.portal === true && existRelatedCapt === false) {
                                        conditions = INTERMediator.additionalCondition;
                                        conditions[targetNameCapt] = {
                                            field: keyField,
                                            operator: '=',
                                            value: keyValueCapt2
                                        };
                                        INTERMediator.additionalCondition = conditions;
                                    }
                                    createdRecord = [{}];
                                    createdRecord[0][keyField] = newRecordId;
                                    INTERMediator.constructMain(associatedContext, result.dbresult);
                                    sameOriginContexts = IMLibContextPool.getContextsWithSameOrigin(associatedContext);
                                    for (i = 0; i < sameOriginContexts.length; i++) {
                                        INTERMediator.constructMain(sameOriginContexts[i], null);
                                    }
                                }
                                IMLibCalc.recalculation();
                                INTERMediatorOnPage.hideProgress();
                                INTERMediatorLog.flushMessage();
                            };
                        })(),
                        function () {
                            INTERMediatorLog.setErrorMessage('Insert Error', 'EXCEPTION-4');
                            completeTask();
                        }
                    );
                }
            };
        })());
    },

    clickPostOnlyButton: function (node) {
        'use strict';
        var i, j, fieldData, elementInfo, comp, contextCount, selectedContext, contextInfo, validationInfo;
        var mergedValues, inputNodes, typeAttr, k, messageNode, result, alertmessage;
        var linkedNodes, namedNodes, index, hasInvalid, isMerged, contextNodes;
        var targetNode = node.parentNode;
        while (!INTERMediatorLib.isEnclosure(targetNode, true)) {
            targetNode = targetNode.parentNode;
            if (!targetNode) {
                return;
            }
        }

        if (INTERMediatorOnPage.processingBeforePostOnlyContext) {
            if (!INTERMediatorOnPage.processingBeforePostOnlyContext(targetNode)) {
                return;
            }
        }

        contextNodes = [];
        linkedNodes = [];
        namedNodes = [];
        for (i = 0; i < targetNode.childNodes.length; i++) {
            seekLinkedElementInThisContext(targetNode.childNodes[i]);
            seekLinkedElementInAllChildren(targetNode.childNodes[i]);
        }
        contextCount = {};
        for (i = 0; i < contextNodes.length; i++) {
            elementInfo = INTERMediatorLib.getLinkedElementInfo(contextNodes[i]);
            for (j = 0; j < elementInfo.length; j++) {
                comp = elementInfo[j].split(INTERMediator.separator);
                if (!contextCount[comp[j]]) {
                    contextCount[comp[j]] = 0;
                }
                contextCount[comp[j]]++;
            }
        }
        if (contextCount.length < 1) {
            return;
        }
        var maxCount = -100;
        for (var contextName in contextCount) {
            if (maxCount < contextCount[contextName]) {
                maxCount = contextCount[contextName];
                selectedContext = contextName;
                contextInfo = INTERMediatorOnPage.getContextInfo(contextName);
            }
        }

        alertmessage = '';
        fieldData = [];
        hasInvalid = false;
        for (i = 0; i < linkedNodes.length; i++) {
            elementInfo = INTERMediatorLib.getLinkedElementInfo(linkedNodes[i]);
            for (j = 0; j < elementInfo.length; j++) {
                comp = elementInfo[j].split(INTERMediator.separator);
                if (comp[0] === selectedContext) {
                    if (contextInfo.validation) {
                        for (index in contextInfo.validation) {
                            if(contextInfo.validation.hasOwnProperty(index)) {
                                validationInfo = contextInfo.validation[index];
                                if (validationInfo && validationInfo.field === comp[1]) {
                                    switch (validationInfo.notify) {
                                    case 'inline':
                                    case 'end-of-sibling':
                                        INTERMediatorLib.clearErrorMessage(linkedNodes[i]);
                                        break;
                                    }
                                }
                            }
                        }
                        for (index in contextInfo.validation) {
                            if (contextInfo.validation.hasOwnProperty(index)) {
                                validationInfo = contextInfo.validation[index];
                                if (validationInfo.field === comp[1]) {
                                    if (validationInfo) {
                                        result = Parser.evaluate(
                                            validationInfo.rule,
                                            {'value': linkedNodes[i].value, 'target': linkedNodes[i]}
                                        );
                                        if (!result) {
                                            hasInvalid = true;
                                            switch (validationInfo.notify) {
                                            case 'inline':
                                                INTERMediatorLib.clearErrorMessage(linkedNodes[i]);
                                                messageNode = INTERMediatorLib.createErrorMessageNode(
                                                    'SPAN', validationInfo.message);
                                                linkedNodes[i].parentNode.insertBefore(
                                                    messageNode, linkedNodes[i].nextSibling);
                                                break;
                                            case 'end-of-sibling':
                                                INTERMediatorLib.clearErrorMessage(linkedNodes[i]);
                                                messageNode = INTERMediatorLib.createErrorMessageNode(
                                                    'DIV', validationInfo.message);
                                                linkedNodes[i].parentNode.appendChild(messageNode);
                                                break;
                                            default:
                                                alertmessage += validationInfo.message + IMLib.nl_char;
                                            }
                                            if (INTERMediatorOnPage.doAfterValidationFailure) {
                                                INTERMediatorOnPage.doAfterValidationFailure(linkedNodes[i]);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (INTERMediatorLib.isWidgetElement(linkedNodes[i])) {
                        fieldData.push({field: comp[1], value: linkedNodes[i]._im_getValue()});
                    } else if (linkedNodes[i].tagName === 'SELECT') {
                        fieldData.push({field: comp[1], value: linkedNodes[i].value});
                    } else if (linkedNodes[i].tagName === 'TEXTAREA') {
                        fieldData.push({field: comp[1], value: linkedNodes[i].value});
                    } else if (linkedNodes[i].tagName === 'INPUT') {
                        if (( linkedNodes[i].getAttribute('type') === 'radio' ) ||
                            ( linkedNodes[i].getAttribute('type') === 'checkbox' )) {
                            if (linkedNodes[i].checked) {
                                fieldData.push({field: comp[1], value: linkedNodes[i].value});
                            }
                        } else {
                            fieldData.push({field: comp[1], value: linkedNodes[i].value});
                        }
                    }
                }
            }
        }
        for (i = 0; i < namedNodes.length; i++) {
            elementInfo = INTERMediatorLib.getNamedInfo(namedNodes[i]);
            for (j = 0; j < elementInfo.length; j++) {
                comp = elementInfo[j].split(INTERMediator.separator);
                if (comp[0] === selectedContext) {
                    mergedValues = [];
                    if (namedNodes[i].tagName === 'INPUT') {
                        inputNodes = [namedNodes[i]];
                    } else {
                        inputNodes = namedNodes[i].getElementsByTagName('INPUT');
                    }
                    for (k = 0; k < inputNodes.length; k++) {
                        typeAttr = inputNodes[k].getAttribute('type');
                        if (typeAttr === 'radio' || typeAttr === 'checkbox') {
                            if (inputNodes[k].checked) {
                                mergedValues.push(inputNodes[k].value);
                            }
                        } else {
                            mergedValues.push(inputNodes[k].value);
                        }
                    }
                    if (mergedValues.length > 0) {
                        isMerged = false;
                        for (index = 0; index < fieldData.length; index++) {
                            if (fieldData[index].field === comp[1]) {
                                fieldData[index].value += IMLibUI.mergedFieldSeparator;
                                fieldData[index].value += mergedValues.join(IMLibUI.mergedFieldSeparator);
                                isMerged = true;
                            }
                        }
                        if (!isMerged) {
                            fieldData.push({
                                field: comp[1],
                                value: mergedValues.join(IMLibUI.mergedFieldSeparator)
                            });
                        }
                    }
                }
            }
        }

        if (alertmessage.length > 0) {
            window.alert(alertmessage);
            return;
        }
        if (hasInvalid) {
            return;
        }

        contextInfo = INTERMediatorLib.getNamedObject(INTERMediatorOnPage.getDataSources(), 'name', selectedContext);
        if (INTERMediatorOnPage.modifyPostOnlyContext) {
            contextInfo = INTERMediatorOnPage.modifyPostOnlyContext(contextInfo);
        }
        INTERMediator_DBAdapter.db_createRecord_async(
            {name: selectedContext, dataset: fieldData},
            function (result) {
                var newNode, parentOfTarget, targetNode = node, thisContext = contextInfo,
                    isSetMsg = false;
                INTERMediatorLog.flushMessage();
                if (INTERMediatorOnPage.processingAfterPostOnlyContext) {
                    INTERMediatorOnPage.processingAfterPostOnlyContext(targetNode, result.newRecordKeyValue);
                }
                if (thisContext['post-dismiss-message']) {
                    parentOfTarget = targetNode.parentNode;
                    parentOfTarget.removeChild(targetNode);
                    newNode = document.createElement('SPAN');
                    INTERMediatorLib.setClassAttributeToNode(newNode, 'IM_POSTMESSAGE');
                    newNode.appendChild(document.createTextNode(thisContext['post-dismiss-message']));
                    parentOfTarget.appendChild(newNode);
                    isSetMsg = true;
                }
                if (thisContext['post-reconstruct']) {
                    setTimeout(function () {
                        INTERMediator.construct(true);
                    }, isSetMsg ? INTERMediator.waitSecondsAfterPostMessage * 1000 : 0);
                }
                if (thisContext['post-move-url']) {
                    setTimeout(function () {
                        location.href = thisContext['post-move-url'];
                    }, isSetMsg ? INTERMediator.waitSecondsAfterPostMessage * 1000 : 0);
                }
            }, null);

        function seekLinkedElementInThisContext(node) {    // Just seek out side of inner enclosure
            var children, i;
            if (node.nodeType === 1) {
                if (INTERMediatorLib.isLinkedElement(node)) {
                    contextNodes.push(node);
                } else if (INTERMediatorLib.isWidgetElement(node)) {
                    contextNodes.push(node);
                } else {
                    if (INTERMediatorLib.isEnclosure(node)) {
                        return;
                    }
                    children = node.childNodes;
                    for (i = 0; i < children.length; i++) {
                        seekLinkedElementInThisContext(children[i]);
                    }
                }
            }
        }

        function seekLinkedElementInAllChildren(node) {   // Traverse inside of enclosure
            var children, i;
            if (node.nodeType === 1) {
                if (INTERMediatorLib.isNamedElement(node)) {
                    namedNodes.push(node);
                } else if (INTERMediatorLib.isLinkedElement(node)) {
                    linkedNodes.push(node);
                } else if (INTERMediatorLib.isWidgetElement(node)) {
                    linkedNodes.push(node);
                } else {
                    children = node.childNodes;
                    for (i = 0; i < children.length; i++) {
                        seekLinkedElementInAllChildren(children[i]);
                    }
                }
            }
        }
    },

    eventUpdateHandler: function (contextName) {
        'use strict';
        IMLibLocalContext.updateAll();
        var context = IMLibContextPool.getContextFromName(contextName);
        INTERMediator.constructMain(context[0]);
    },

    eventAddOrderHandler: function (e) {    // e is mouse event
        'use strict';
        var targetKey, targetSplit, key, itemSplit, extValue;
        if (e.target) {
            targetKey = e.target.getAttribute('data-im');
        } else {
            targetKey = e.srcElement.getAttribute('data-im');
        }
        targetSplit = targetKey.split(':');
        if (targetSplit[0] !== '_@addorder' || targetSplit.length < 3) {
            return;
        }
        for (key in IMLibLocalContext.store) {
            if(IMLibLocalContext.store.hasOwnProperty(key)) {
                itemSplit = key.split(':');
                if (itemSplit.length > 3 && itemSplit[0] === 'valueofaddorder' && itemSplit[1] === targetSplit[1]) {
                    extValue = IMLibLocalContext.getValue(key);
                    if (extValue) {
                        IMLibLocalContext.store[key]++;
                    }
                }
            }
        }
        IMLibLocalContext.setValue('valueof' + targetKey.substring(2), 1);
        IMLibUI.eventUpdateHandler(targetSplit[1]);
    }
};
