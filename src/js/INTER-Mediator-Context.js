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
/* global INTERMediator, INTERMediatorOnPage, IMLibMouseEventDispatch, IMLibUI, IMLibKeyDownEventDispatch,
 IMLibChangeEventDispatch, INTERMediatorLib, INTERMediator_DBAdapter, IMLibQueue, IMLibCalc, IMLibPageNavigation,
 IMLibEventResponder, IMLibElement, Parser, IMLib, INTERMediatorLog */
/* jshint -W083 */ // Function within a loop

/**
 * @fileoverview IMLibContextPool, IMLibContext and IMLibLocalContext classes are defined here.
 */
/**
 *
 * Usually you don't have to instanciate this class with new operator.
 * @constructor
 */
const IMLibContextPool = {
  poolingContexts: null,

  clearAll: function () {
    'use strict'
    this.poolingContexts = null
  },

  registerContext: function (context) {
    'use strict'
    if (this.poolingContexts === null) {
      this.poolingContexts = [context]
    } else {
      this.poolingContexts.push(context)
    }
  },

  excludingNode: null,

  synchronize: function (context, recKey, key, value, target, portal) {
    'use strict'
    var i, j, viewName, refNode, targetNodes
    let result = []
    let calcKey
    viewName = context.viewName
    if (this.poolingContexts === null) {
      return null
    }
    if (portal) {
      for (i = 0; i < this.poolingContexts.length; i += 1) {
        if (this.poolingContexts[i].viewName === viewName &&
          this.poolingContexts[i].binding[recKey] !== undefined &&
          this.poolingContexts[i].binding[recKey][key] !== undefined &&
          this.poolingContexts[i].binding[recKey][key][portal] !== undefined &&
          this.poolingContexts[i].store[recKey] !== undefined &&
          this.poolingContexts[i].store[recKey][key] !== undefined &&
          this.poolingContexts[i].store[recKey][key][portal] !== undefined) {
          this.poolingContexts[i].store[recKey][key][portal] = value
          targetNodes = this.poolingContexts[i].binding[recKey][key][portal]
          for (j = 0; j < targetNodes.length; j++) {
            refNode = document.getElementById(targetNodes[j].id)
            if (refNode) {
              IMLibElement.setValueToIMNode(refNode, targetNodes[j].target, value, true)
              result.push(targetNodes[j].id)
            }
          }
        }
      }
    } else {
      for (i = 0; i < this.poolingContexts.length; i += 1) {
        if (this.poolingContexts[i].viewName === viewName &&
          this.poolingContexts[i].binding[recKey] !== undefined &&
          this.poolingContexts[i].binding[recKey][key] !== undefined &&
          this.poolingContexts[i].store[recKey] !== undefined &&
          this.poolingContexts[i].store[recKey][key] !== undefined) {
          this.poolingContexts[i].store[recKey][key] = value
          targetNodes = this.poolingContexts[i].binding[recKey][key]
          for (j = 0; j < targetNodes.length; j++) {
            refNode = document.getElementById(targetNodes[j].id)
            calcKey = targetNodes[j].id
            if (targetNodes[j].target && targetNodes[j].target.length > 0) {
              calcKey += INTERMediator.separator + targetNodes[j].target
            }
            if (refNode && !(calcKey in IMLibCalc.calculateRequiredObject)) {
              IMLibElement.setValueToIMNode(refNode, targetNodes[j].target, value, true)
              result.push(targetNodes[j].id)
            }
          }
        }
      }
    }
    return result
  },

  getContextInfoFromId: function (idValue, target) {
    'use strict'
    var i, targetContext, element, linkInfo, nodeInfo, targetName
    let result = null
    if (!idValue) {
      return result
    }

    element = document.getElementById(idValue)
    if (!element) {
      return result
    }

    linkInfo = INTERMediatorLib.getLinkedElementInfo(element)
    if (!linkInfo && INTERMediatorLib.isWidgetElement(element.parentNode)) {
      linkInfo = INTERMediatorLib.getLinkedElementInfo(element.parentNode)
    }
    nodeInfo = INTERMediatorLib.getNodeInfoArray(linkInfo[0])

    targetName = target ? target : '_im_no_target'
    if (this.poolingContexts === null) {
      return null
    }
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      targetContext = this.poolingContexts[i]
      if (targetContext.contextInfo[idValue] &&
        targetContext.contextInfo[idValue][targetName] &&
        targetContext.contextInfo[idValue][targetName].context.contextName === nodeInfo.table) {
        result = targetContext.contextInfo[idValue][targetName]
        return result
      }
    }
    return null
  },

  getKeyFieldValueFromId: function (idValue, target) {
    'use strict'
    var contextInfo = this.getContextInfoFromId(idValue, target)
    if (!contextInfo) {
      return null
    }
    var contextName = contextInfo.context.contextName
    var contextDef = IMLibContextPool.getContextDef(contextName)
    if (!contextDef) {
      return null
    }
    var keyField = contextDef.key ? contextDef.key : 'id'
    return contextInfo.record.substr(keyField.length + 1)
  },

  updateContext: function (idValue, target) {
    'use strict'
    var contextInfo, value
    contextInfo = IMLibContextPool.getContextInfoFromId(idValue, target)
    value = IMLibElement.getValueFromIMNode(document.getElementById(idValue))
    if (contextInfo) {
      contextInfo.context.setValue(
        contextInfo.record, contextInfo.field, value, false, target, contextInfo.portal)
    }
  },

  getContextFromEnclosure: function (enclosureNode) {
    'use strict'
    var i

    for (i = 0; i < this.poolingContexts.length; i += 1) {
      if (this.poolingContexts[i].enclosureNode === enclosureNode) {
        return this.poolingContexts[i]
      }
    }
  },

  contextFromEnclosureId: function (idValue) {
    'use strict'
    var i, enclosure
    if (!idValue) {
      return false
    }
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      enclosure = this.poolingContexts[i].enclosureNode
      if (enclosure.getAttribute('id') === idValue) {
        return this.poolingContexts[i]
      }
    }
    return null
  },

  contextFromName: function (cName) {
    'use strict'
    var i
    if (!cName) {
      return false
    }
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      if (this.poolingContexts[i].contextName === cName) {
        return this.poolingContexts[i]
      }
    }
    return null
  },

  getContextFromName: function (cName) {
    'use strict'
    var i
    let result = []
    if (!cName) {
      return false
    }
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      if (this.poolingContexts[i].contextName === cName) {
        result.push(this.poolingContexts[i])
      }
    }
    return result
  },

  getContextsFromNameAndForeignValue: function (cName, fValue, parentKeyField) {
    'use strict'
    var i
    let result = []
    if (!cName) {
      return false
    }
    // parentKeyField = 'id'
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      if (this.poolingContexts[i].contextName === cName &&
        this.poolingContexts[i].foreignValue[parentKeyField] === fValue) {
        result.push(this.poolingContexts[i])
      }
    }
    return result
  },

  dependingObjects: function (idValue) {
    'use strict'
    var i, j
    let result = []
    if (!idValue) {
      return false
    }
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      for (j = 0; j < this.poolingContexts[i].dependingObject.length; j++) {
        if (this.poolingContexts[i].dependingObject[j] === idValue) {
          result.push(this.poolingContexts[i])
        }
      }
    }
    return result.length === 0 ? false : result
  },

  getChildContexts: function (parentContext) {
    'use strict'
    var i
    let childContexts = []
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      if (this.poolingContexts[i].parentContext === parentContext) {
        childContexts.push(this.poolingContexts[i])
      }
    }
    return childContexts
  },

  childContexts: null,

  removeContextsFromPool: function (contexts) {
    'use strict'
    var i
    let regIds = []
    let delIds = []
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      if (contexts.indexOf(this.poolingContexts[i]) > -1) {
        regIds.push(this.poolingContexts[i].registeredId)
        delIds.push(i)
      }
    }
    for (i = delIds.length - 1; i > -1; i--) {
      this.poolingContexts.splice(delIds[i], 1)
    }
    return regIds
  },

  removeRecordFromPool: function (repeaterIdValue) {
    'use strict'
    var i, j, field
    let nodeIds = []
    let targetKeying, targetKeyingObj, parentKeying, relatedId, idValue, delNodes,
      contextAndKey, sameOriginContexts, countDeleteNodes

    contextAndKey = getContextAndKeyFromId(repeaterIdValue)
    if (contextAndKey === null) {
      return
    }
    sameOriginContexts = this.getContextsWithSameOrigin(contextAndKey.context)
    // sameOriginContexts.push(contextAndKey.context)
    targetKeying = contextAndKey.key
    // targetKeyingObj = contextAndKey.context.binding[targetKeying]

    for (i = 0; i < sameOriginContexts.length; i += 1) {
      targetKeyingObj = sameOriginContexts[i].binding[targetKeying]
      for (field in targetKeyingObj) {
        if (targetKeyingObj.hasOwnProperty(field)) {
          for (j = 0; j < targetKeyingObj[field].length; j++) {
            if (nodeIds.indexOf(targetKeyingObj[field][j].id) < 0) {
              nodeIds.push(targetKeyingObj[field][j].id)
            }
          }
        }
      }

      if (INTERMediatorOnPage.dbClassName === 'FileMaker_FX' ||
        INTERMediatorOnPage.dbClassName === 'FileMaker_DataAPI') {
        // for FileMaker portal access mode
        parentKeying = Object.keys(contextAndKey.context.binding)[0]
        relatedId = targetKeying.split('=')[1]
        if (sameOriginContexts[i].binding[parentKeying] &&
          sameOriginContexts[i].binding[parentKeying]._im_repeater &&
          sameOriginContexts[i].binding[parentKeying]._im_repeater[relatedId] &&
          sameOriginContexts[i].binding[parentKeying]._im_repeater[relatedId][0]) {
          nodeIds.push(sameOriginContexts[i].binding[parentKeying]._im_repeater[relatedId][0].id)
        }
      }
    }
    delNodes = []
    for (i = 0; i < sameOriginContexts.length; i += 1) {
      for (idValue in sameOriginContexts[i].contextInfo) {
        if (sameOriginContexts[i].contextInfo.hasOwnProperty(idValue)) {
          if (nodeIds.indexOf(idValue) >= 0) {
            delete contextAndKey.context.contextInfo[idValue]
            delNodes.push(idValue)
          }
        }
      }
      delete sameOriginContexts[i].binding[targetKeying]
      delete sameOriginContexts[i].store[targetKeying]
    }
    countDeleteNodes = delNodes.length
    IMLibElement.deleteNodes(delNodes)

    this.poolingContexts = this.poolingContexts.filter(function (context) {
      return nodeIds.indexOf(context.enclosureNode.id) < 0
    })

    return countDeleteNodes

    // Private functions
    function getContextAndKeyFromId (repeaterIdValue) {
      var i, field, j, keying, foreignKey

      for (i = 0; i < IMLibContextPool.poolingContexts.length; i += 1) {
        for (keying in IMLibContextPool.poolingContexts[i].binding) {
          if (IMLibContextPool.poolingContexts[i].binding.hasOwnProperty(keying)) {
            for (field in IMLibContextPool.poolingContexts[i].binding[keying]) {
              if (IMLibContextPool.poolingContexts[i].binding[keying].hasOwnProperty(field) &&
                field === '_im_repeater') {
                for (j = 0; j < IMLibContextPool.poolingContexts[i].binding[keying][field].length; j++) {
                  if (repeaterIdValue === IMLibContextPool.poolingContexts[i].binding[keying][field][j].id) {
                    return ({context: IMLibContextPool.poolingContexts[i], key: keying})
                  }
                }

                if (INTERMediatorOnPage.dbClassName === 'FileMaker_FX' ||
                  INTERMediatorOnPage.dbClassName === 'FileMaker_DataAPI') {
                  // for FileMaker portal access mode
                  for (foreignKey in IMLibContextPool.poolingContexts[i].binding[keying][field]) {
                    if (IMLibContextPool.poolingContexts[i].binding[keying][field].hasOwnProperty(foreignKey)) {
                      for (j = 0; j < IMLibContextPool.poolingContexts[i].binding[keying][field][foreignKey].length; j++) {
                        if (repeaterIdValue === IMLibContextPool.poolingContexts[i].binding[keying][field][foreignKey][j].id) {
                          return ({
                            context: IMLibContextPool.poolingContexts[i],
                            key: INTERMediatorOnPage.defaultKeyName + '=' + foreignKey
                          })
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      return null
    }
  },

  getContextsWithSameOrigin: function (originalContext) {
    'use strict'
    var i
    let contexts = []
    let contextDef
    let isPortal = false

    contextDef = IMLibContextPool.getContextDef(originalContext.contextName)
    if (contextDef && contextDef.relation) {
      for (i in contextDef.relation) {
        if (contextDef.relation.hasOwnProperty(i) && contextDef.relation[i].portal) {
          isPortal = true
          break
        }
      }
    }
    for (i = 0; i < IMLibContextPool.poolingContexts.length; i += 1) {
      if (IMLibContextPool.poolingContexts[i].sourceName === originalContext.sourceName) {
        if (!isPortal || originalContext.parentContext !== IMLibContextPool.poolingContexts[i]) {
          contexts.push(IMLibContextPool.poolingContexts[i])
        }
      }
    }
    return contexts
  },

  updateOnAnotherClient: async function (eventName, info) {
    'use strict'
    var i, j, k
    let entityName = info.entity
    let contextDef, contextView, keyField, recKey

    if (eventName === 'update') {
      for (i = 0; i < this.poolingContexts.length; i += 1) {
        contextDef = this.getContextDef(this.poolingContexts[i].contextName)
        contextView = contextDef.view ? contextDef.view : contextDef.name
        if (contextView === entityName) {
          keyField = contextDef.key
          recKey = keyField + '=' + info.pkvalue
          this.poolingContexts[i].setValue(recKey, info.field[0], info.value[0])

          var bindingInfo = this.poolingContexts[i].binding[recKey][info.field[0]]
          for (j = 0; j < bindingInfo.length; j++) {
            var updateRequiredContext = IMLibContextPool.dependingObjects(bindingInfo[j].id)
            for (k = 0; k < updateRequiredContext.length; k++) {
              updateRequiredContext[k].foreignValue = {}
              updateRequiredContext[k].foreignValue[info.field[0]] = info.value[0]
              if (updateRequiredContext[k]) {
                await INTERMediator.constructMain(updateRequiredContext[k])
              }
            }
          }
        }
      }
      IMLibCalc.recalculation()
    } else if (eventName === 'create') {
      for (i = 0; i < this.poolingContexts.length; i += 1) {
        contextDef = this.getContextDef(this.poolingContexts[i].contextName)
        contextView = contextDef.view ? contextDef.view : contextDef.name
        if (contextView === entityName) {
          if (this.poolingContexts[i].isContaining(info.value[0])) {
            await INTERMediator.constructMain(this.poolingContexts[i], info.value)
          }
        }
      }
      IMLibCalc.recalculation()
    } else if (eventName === 'delete') {
      for (i = 0; i < this.poolingContexts.length; i += 1) {
        contextDef = this.getContextDef(this.poolingContexts[i].contextName)
        contextView = contextDef.view ? contextDef.view : contextDef.name
        if (contextView === entityName) {
          this.poolingContexts[i].removeEntry(info.pkvalue)
        }
      }
      IMLibCalc.recalculation()
    }
  },

  getMasterContext: function () {
    'use strict'
    var i, contextDef
    if (!this.poolingContexts) {
      return null
    }
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      contextDef = this.poolingContexts[i].getContextDef()
      if (contextDef['navi-control'] && contextDef['navi-control'].match(/master/)) {
        return this.poolingContexts[i]
      }
    }
    return null
  },

  getDetailContext: function () {
    'use strict'
    var i, contextDef
    if (!this.poolingContexts) {
      return null
    }
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      contextDef = this.poolingContexts[i].getContextDef()
      if (contextDef['navi-control'] && contextDef['navi-control'].match(/detail/)) {
        return this.poolingContexts[i]
      }
    }
    return null
  },

  getContextDef: function (contextName) {
    'use strict'
    return INTERMediatorLib.getNamedObject(INTERMediatorOnPage.getDataSources(), 'name', contextName)
  },

  getContextFromNodeId: function (nodeId) {
    'use strict'
    var i, context, contextDef, rKey, fKey, pKey, isPortal, bindInfo
    if (!this.poolingContexts) {
      return null
    }
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      context = this.poolingContexts[i]
      contextDef = context.getContextDef()
      isPortal = false
      if (contextDef.relation) {
        for (rKey in contextDef.relation) {
          if (contextDef.relation[rKey].portal) {
            isPortal = true
          }
        }
      }
      for (rKey in context.binding) {
        if (context.binding.hasOwnProperty(rKey)) {
          for (fKey in context.binding[rKey]) {
            if (isPortal) {
              for (pKey in context.binding[rKey][fKey]) {
                if (context.binding[rKey][fKey].hasOwnProperty(pKey)) {
                  bindInfo = context.binding[rKey][fKey][pKey]
                  if (bindInfo.nodeId === nodeId) {
                    return context
                  }
                }
              }
            } else {
              bindInfo = context.binding[rKey][fKey]
              if (bindInfo.nodeId === nodeId) {
                return context
              }
            }
          }
        }
      }
    }
    return null
  },

  getContextFromEnclosureNode: function (enclosureNode) {
    'use strict'
    var i, context
    if (!this.poolingContexts) {
      return null
    }
    for (i = 0; i < this.poolingContexts.length; i += 1) {
      context = this.poolingContexts[i]
      if (context.enclosureNode === enclosureNode) {
        return context
      }
    }
    return null
  },

  generateContextObject: function (contextDef, enclosure, repeaters, repeatersOriginal) {
    'use strict'
    var contextObj = new IMLibContext(contextDef.name)
    contextObj.contextDefinition = contextDef
    contextObj.enclosureNode = enclosure
    contextObj.repeaterNodes = repeaters
    contextObj.original = repeatersOriginal
    contextObj.sequencing = true
    return contextObj
  },

  getPagingContext: function () {
    'use strict'
    var i, context, contextDef
    if (this.poolingContexts) {
      for (i = 0; i < this.poolingContexts.length; i += 1) {
        context = this.poolingContexts[i]
        contextDef = context.getContextDef()
        if (contextDef.paging) {
          return context
        }
      }
    }
    return null
  }
}

/**
 *
 * @constructor
 */
var IMLibContext = function (contextName) {
  'use strict'
  this.contextName = contextName // Context Name, set on initialization.
  this.tableName = null
  this.viewName = null
  this.sourceName = null
  this.contextDefinition = null // Context Definition object, set on initialization.
  this.store = {}
  this.binding = {}
  this.contextInfo = {}
  this.modified = {}
  this.recordOrder = []
  this.pendingOrder = []
  IMLibContextPool.registerContext(this)

  this.foreignValue = {}
  this.enclosureNode = null // Set on initialization.
  this.repeaterNodes = null // Set on initialization.
  this.dependingObject = []
  this.original = null // Set on initialization.
  this.nullAcceptable = true
  this.parentContext = null
  this.registeredId = null
  this.sequencing = false // Set true on initialization.
  this.dependingParentObjectInfo = null
  this.isPortal = false
  this.potalContainingRecordKV = null

  /*
   * Initialize this object
   */
  this.setTable(this)
}

IMLibContext.prototype.updateFieldValue = async function (idValue, succeedProc, errorProc, warnMultipleRecProc, warnOthersModifyProc) {
  'use strict'
  var nodeInfo, contextInfo, linkInfo, changedObj, criteria, newValue

  changedObj = document.getElementById(idValue)
  linkInfo = INTERMediatorLib.getLinkedElementInfo(changedObj)
  nodeInfo = INTERMediatorLib.getNodeInfoArray(linkInfo[0]) // Suppose to be the first definition.
  contextInfo = IMLibContextPool.getContextInfoFromId(idValue, nodeInfo.target) // suppose to target = ''

  if (INTERMediator.ignoreOptimisticLocking) {
    IMLibContextPool.updateContext(idValue, nodeInfo.target)
    newValue = IMLibElement.getValueFromIMNode(changedObj)
    if (newValue !== null) {
      criteria = contextInfo.record.split('=')
      // await INTERMediatorOnPage.retrieveAuthInfo()
      if (contextInfo.context.isPortal) {
        criteria = contextInfo.context.potalContainingRecordKV.split('=')
        INTERMediator_DBAdapter.db_update_async(
          {
            name: contextInfo.context.parentContext.contextName,
            conditions: [{field: criteria[0], operator: '=', value: criteria[1]}],
            dataset: [
              {
                field: contextInfo.field + '.' + contextInfo.record.split('=')[1],
                value: newValue
              }
            ]
          },
          succeedProc,
          errorProc
        )
      } else {
        criteria = contextInfo.record.split('=')
        INTERMediator_DBAdapter.db_update_async(
          {
            name: contextInfo.context.contextName,
            conditions: [{field: criteria[0], operator: '=', value: criteria[1]}],
            dataset: [{field: contextInfo.field, value: newValue}]
          },
          succeedProc,
          errorProc
        )
      }
    }
  } else {
    var targetContext = contextInfo.context
    var parentContext, keyingComp
    if (targetContext.isPortal === true) {
      parentContext = IMLibContextPool.getContextFromName(targetContext.sourceName)[0]
    } else {
      parentContext = targetContext.parentContext
    }
    var targetField = contextInfo.field
    if (targetContext.isPortal === true) {
      keyingComp = Object.keys(parentContext.store)[0].split('=')
    } else {
      keyingComp = (targetContext.isPortal ? targetContext.potalContainingRecordKV : contextInfo.record).split('=')
    }
    var keyingField = keyingComp[0]
    keyingComp.shift()
    var keyingValue = keyingComp.join('=')
    await INTERMediator_DBAdapter.db_query_async(
      {
        name: targetContext.isPortal ? parentContext.contextName : targetContext.contextName,
        records: 1,
        paging: false,
        fields: [contextInfo.field],
        parentkeyvalue: null,
        conditions: [
          {field: keyingField, operator: '=', value: keyingValue}
        ],
        useoffset: false,
        primaryKeyOnly: true
      },
      (function () {
        var targetFieldCapt = targetField
        var contextInfoCapt = contextInfo
        var targetContextCapt = targetContext
        var changedObjectCapt = changedObj
        var nodeInfoCapt = nodeInfo
        var idValueCapt = idValue
        return function (result) {
          var recordset = []
          var initialvalue, newValue, isOthersModified, currentFieldVal,
            portalRecords, index, keyField, keyingComp, criteria
          if (targetContextCapt.isPortal) {
            portalRecords = targetContextCapt.getPortalRecordsetImpl(
              result.dbresult[0],
              targetContextCapt.contextName)
            keyField = targetContextCapt.getKeyField()
            keyingComp = contextInfoCapt.record.split('=')
            for (index = 0; index < portalRecords.length; index++) {
              if (portalRecords[index][keyField] === keyingComp[1]) {
                recordset.push(portalRecords[index])
                break
              }
            }
          } else {
            recordset = result.dbresult
          }
          if (!recordset || !recordset[0] || // This value could be null or undefined
            recordset[0][targetFieldCapt] === undefined) {
            errorProc()
            return
          }
          if (result.resultCount > 1) {
            if (!warnMultipleRecProc()) {
              return
            }
          }
          if (targetContextCapt.isPortal) {
            for (var i = 0; i < recordset.length; i += 1) {
              if (recordset[i][INTERMediatorOnPage.defaultKeyName] === contextInfo.record.split('=')[1]) {
                currentFieldVal = recordset[i][targetFieldCapt]
                break
              }
            }
            initialvalue = targetContextCapt.getValue(
              Object.keys(parentContext.store)[0],
              targetFieldCapt,
              INTERMediatorOnPage.defaultKeyName + '=' + recordset[i][INTERMediatorOnPage.defaultKeyName]
            )
          } else {
            currentFieldVal = recordset[0][targetFieldCapt]
            initialvalue = targetContextCapt.getValue(contextInfoCapt.record, targetFieldCapt)
          }
          if (INTERMediatorOnPage.dbClassName === 'FileMaker_DataAPI') {
            if (typeof (initialvalue) === 'number' && typeof (currentFieldVal) === 'string') {
              initialvalue = initialvalue.toString()
            }
          }
          isOthersModified = checkSameValue(initialvalue, currentFieldVal)
          if (changedObjectCapt.tagName === 'INPUT' &&
            changedObjectCapt.getAttribute('type') === 'checkbox') {
            if (initialvalue === changedObjectCapt.value) {
              isOthersModified = false
            } else if (!parseInt(currentFieldVal)) {
              isOthersModified = false
            } else {
              isOthersModified = true
            }
          }
          if (isOthersModified) {
            // The value of database and the field is different. Others must be changed this field.
            newValue = IMLibElement.getValueFromIMNode(changedObjectCapt)
            if (!warnOthersModifyProc(initialvalue, newValue, currentFieldVal)) {
              return
            }
            // await INTERMediatorOnPage.retrieveAuthInfo() // This is required. Why?
          }
          IMLibContextPool.updateContext(idValueCapt, nodeInfoCapt.target)
          newValue = IMLibElement.getValueFromIMNode(changedObjectCapt)
          if (newValue !== null) {
            if (targetContextCapt.isPortal) {
              if (targetContextCapt.potalContainingRecordKV == null) {
                criteria = Object.keys(targetContextCapt.foreignValue)
                criteria[1] = targetContextCapt.foreignValue[criteria[0]]
              } else {
                criteria = targetContextCapt.potalContainingRecordKV.split('=')
              }
              INTERMediator_DBAdapter.db_update_async(
                {
                  name: targetContextCapt.isPortal ? targetContextCapt.sourceName : targetContextCapt.parentContext.contextName,
                  conditions: [{field: criteria[0], operator: '=', value: criteria[1]}],
                  dataset: [
                    {
                      field: contextInfoCapt.field + '.' + contextInfoCapt.record.split('=')[1],
                      value: newValue
                    }
                  ]
                },
                succeedProc,
                errorProc
              )
            } else {
              criteria = contextInfoCapt.record.split('=')
              INTERMediator_DBAdapter.db_update_async(
                {
                  name: targetContextCapt.contextName,
                  conditions: [{field: criteria[0], operator: '=', value: criteria[1]}],
                  dataset: [{field: contextInfo.field, value: newValue}]
                },
                succeedProc,
                errorProc
              )
            }
          }
        }
      })(),
      function () {
        INTERMediatorOnPage.hideProgress()
        INTERMediatorLog.setErrorMessage('Error in valueChange method.', 'EXCEPTION-1')
      }
    )
  }

  function checkSameValue (initialValue, currentFieldVal) {
    var handleAsNullValue = ['0000-00-00', '0000-00-00 00:00:00']
    if (handleAsNullValue.indexOf(initialValue) >= 0) {
      initialValue = ''
    }
    if (handleAsNullValue.indexOf(currentFieldVal) >= 0) {
      currentFieldVal = ''
    }
    return initialValue !== currentFieldVal
  }
}

IMLibContext.prototype.getKeyField = function () {
  'use strict'
  var keyField
  if (INTERMediatorOnPage.dbClassName === 'FileMaker_FX' ||
    INTERMediatorOnPage.dbClassName === 'FileMaker_DataAPI') {
    if (this.isPortal) {
      keyField = INTERMediatorOnPage.defaultKeyName
    } else {
      keyField = this.contextDefinition.key ? this.contextDefinition.key : INTERMediatorOnPage.defaultKeyName
    }
  } else {
    keyField = this.contextDefinition.key ? this.contextDefinition.key : 'id'
  }
  return keyField
}

IMLibContext.prototype.getCalculationFields = function () {
  'use strict'
  var calcDef = this.contextDefinition.calculation
  var calcFields = []
  let ix
  for (ix in calcDef) {
    if (calcDef.hasOwnProperty(ix)) {
      calcFields.push(calcDef[ix].field)
    }
  }
  return calcFields
}

IMLibContext.prototype.isUseLimit = function () {
  'use strict'
  var useLimit = false
  if (this.contextDefinition.records && this.contextDefinition.paging) {
    useLimit = true
  }
  return useLimit
}

IMLibContext.prototype.getPortalRecords = function () {
  'use strict'
  var targetRecords = {}
  if (!this.isPortal) {
    return null
  }
  targetRecords.dbresult = this.getPortalRecordsetImpl(
    this.parentContext.store[this.potalContainingRecordKV], this.contextName)
  return targetRecords
}

IMLibContext.prototype.getPortalRecordsetImpl = function (store, contextName) {
  'use strict'
  var result, recId, recordset, key, contextDef
  recordset = []
  if (store[0]) {
    if (!store[0][contextName]) {
      for (key in store[0]) {
        if (store[0].hasOwnProperty(key)) {
          contextDef = INTERMediatorLib.getNamedObject(INTERMediatorOnPage.getDataSources(), 'name', key)
          if (contextName === contextDef.view && !store[0][contextName]) {
            contextName = key
            break
          }
        }
      }
    }
    if (store[0][contextName]) {
      result = store[0][contextName]
      for (recId in result) {
        if (result.hasOwnProperty(recId) && isFinite(recId)) {
          recordset.push(result[recId])
        }
      }
    }
  }
  return recordset
}

IMLibContext.prototype.getRecordNumber = function () {
  'use strict'
  var recordNumber, key, value, keyParams

  if (this.contextDefinition['navi-control'] &&
    this.contextDefinition['navi-control'] === 'detail') {
    recordNumber = 1
  } else {
    // The number of records is the records keyed value.
    recordNumber = parseInt(this.contextDefinition.records, 10)
    // From INTERMediator.recordLimit property
    for (key in INTERMediator.recordLimit) {
      if (INTERMediator.recordLimit.hasOwnProperty(key)) {
        value = String(INTERMediator.recordLimit[key])
        if (key === this.contextDefinition.name &&
          value.length > 0) {
          recordNumber = parseInt(value)
          INTERMediator.setLocalProperty('_im_pagedSize', recordNumber)
        }
      }
    }
    // From INTERMediator.pagedSize
    if (parseInt(INTERMediator.pagedSize, 10) > 0) {
      recordNumber = INTERMediator.pagedSize
      INTERMediator.setLocalProperty('_im_pagedSize', recordNumber)
    }
    // From Local context's limitnumber directive
    for (key in IMLibLocalContext.store) {
      if (IMLibLocalContext.store.hasOwnProperty(key)) {
        value = String(IMLibLocalContext.store[key])
        keyParams = key.split(':')
        if (keyParams &&
          keyParams.length > 1 &&
          keyParams[1].trim() === this.contextDefinition.name &&
          value.length > 0 &&
          keyParams[0].trim() === 'limitnumber') {
          recordNumber = parseInt(value)
          INTERMediator.setLocalProperty('_im_pagedSize', recordNumber)
        }
      }
    }
    // In case of paginating context, set INTERMediator.pagedSize property.
    if (!this.contextDefinition.relation &&
      this.contextDefinition.paging &&
      Boolean(this.contextDefinition.paging) === true) {
      INTERMediator.setLocalProperty('_im_pagedSize', recordNumber)
      INTERMediator.pagedSize = recordNumber
    }
  }
  return recordNumber
}

IMLibContext.prototype.setRelationWithParent = function (currentRecord, parentObjectInfo, parentContext) {
  'use strict'
  var relationDef, index, joinField, fieldName, i

  this.parentContext = parentContext

  if (currentRecord) {
    try {
      relationDef = this.contextDefinition.relation
      if (relationDef) {
        for (index in relationDef) {
          if (relationDef.hasOwnProperty(index)) {
            if (Boolean(relationDef[index].portal) === true) {
              this.isPortal = true
              this.potalContainingRecordKV = INTERMediatorOnPage.defaultKeyName + '=' +
                currentRecord[INTERMediatorOnPage.defaultKeyName]
            }
            joinField = relationDef[index]['join-field']
            this.addForeignValue(joinField, currentRecord[joinField])
            for (fieldName in parentObjectInfo) {
              if (fieldName === relationDef[index]['join-field']) {
                for (i = 0; i < parentObjectInfo[fieldName].length; i += 1) {
                  this.addDependingObject(parentObjectInfo[fieldName][i])
                }
                this.dependingParentObjectInfo =
                  JSON.parse(JSON.stringify(parentObjectInfo))
              }
            }
          }
        }
      }
    } catch (ex) {
      if (ex.message === '_im_auth_required_') {
        throw ex
      } else {
        INTERMediatorLog.setErrorMessage(ex, 'EXCEPTION-25')
      }
    }
  }
}

IMLibContext.prototype.getInsertOrder = function (/* record */) {
  'use strict'
  var cName
  let sortKeys = []
  let contextDef, i
  let sortFields = []
  let sortDirections = []
  for (cName in INTERMediator.additionalSortKey) {
    if (cName === this.contextName) {
      sortKeys.push(INTERMediator.additionalSortKey[cName])
    }
  }
  contextDef = this.getContextDef()
  if (contextDef.sort) {
    sortKeys.push(contextDef.sort)
  }
  for (i = 0; i < sortKeys.length; i += 1) {
    if (sortFields.indexOf(sortKeys[i].field) < 0) {
      sortFields.push(sortKeys[i].field)
      sortDirections.push(sortKeys[i].direction)
    }
  }
}

IMLibContext.prototype.indexingArray = function (keyField) {
  'use strict'
  var ar = []
  let key
  let counter = 0
  for (key in this.store) {
    if (this.store.hasOwnProperty(key)) {
      ar[counter] = this.store[key][keyField]
      counter += 1
    }
  }
  return ar
}

IMLibContext.prototype.clearAll = function () {
  'use strict'
  this.store = {}
  this.binding = {}
}

IMLibContext.prototype.setContextName = function (name) {
  'use strict'
  this.contextName = name
}

IMLibContext.prototype.getContextDef = function () {
  'use strict'
  return INTERMediatorLib.getNamedObject(INTERMediatorOnPage.getDataSources(), 'name', this.contextName)
}

IMLibContext.prototype.setTableName = function (name) {
  'use strict'
  this.tableName = name
}

IMLibContext.prototype.setViewName = function (name) {
  'use strict'
  this.viewName = name
}

IMLibContext.prototype.addDependingObject = function (idNumber) {
  'use strict'
  this.dependingObject.push(idNumber)
}

IMLibContext.prototype.addForeignValue = function (field, value) {
  'use strict'
  this.foreignValue[field] = value
}

IMLibContext.prototype.setOriginal = function (repeaters) {
  'use strict'
  var i
  this.original = []
  for (i = 0; i < repeaters.length; i += 1) {
    this.original.push(repeaters[i].cloneNode(true))
  }
}

IMLibContext.prototype.setTable = function (context) {
  'use strict'
  var contextDef
  if (!context || !INTERMediatorOnPage.getDataSources) {
    this.tableName = this.contextName
    this.viewName = this.contextName
    this.sourceName = this.contextName
    // This is not a valid case, it just prevent the error in the unit test.
    return
  }
  contextDef = this.getContextDef()
  if (contextDef) {
    this.viewName = contextDef.view ? contextDef.view : contextDef.name
    this.tableName = contextDef.table ? contextDef.table : contextDef.name
    this.sourceName = (contextDef.source ? contextDef.source
      : (contextDef.table ? contextDef.table
        : (contextDef.view ? contextDef.view : contextDef.name)))
  }
}

IMLibContext.prototype.removeContext = function () {
  'use strict'
  var regIds = []
  let childContexts = []
  seekRemovingContext(this)
  regIds = IMLibContextPool.removeContextsFromPool(childContexts)
  while (this.enclosureNode.firstChild) {
    this.enclosureNode.removeChild(this.enclosureNode.firstChild)
  }
  INTERMediator_DBAdapter.unregister(regIds)

  function seekRemovingContext (context) {
    var i, myChildren
    childContexts.push(context)
    regIds.push(context.registeredId)
    myChildren = IMLibContextPool.getChildContexts(context)
    for (i = 0; i < myChildren.length; i += 1) {
      seekRemovingContext(myChildren[i])
    }
  }
}

IMLibContext.prototype.setModified = function (recKey, key, value) {
  'use strict'
  if (this.modified[recKey] === undefined) {
    this.modified[recKey] = {}
  }
  this.modified[recKey][key] = value
}

IMLibContext.prototype.getModified = function () {
  'use strict'
  return this.modified
}

IMLibContext.prototype.clearModified = function () {
  'use strict'
  this.modified = {}
}

IMLibContext.prototype.getContextDef = function () {
  'use strict'
  var contextDef
  contextDef = INTERMediatorLib.getNamedObject(
    INTERMediatorOnPage.getDataSources(), 'name', this.contextName)
  return contextDef
}

/*
 * The isDebug parameter is for debugging and testing. Usually you should not specify it.
 */
IMLibContext.prototype.checkOrder = function (oneRecord, isDebug) {
  'use strict'
  var i
  let fields = []
  let directions = []
  let oneSortKey, condtextDef, lower, upper, index, targetRecord, contextValue, checkingValue, stop
  if (isDebug !== true) {
    if (INTERMediator && INTERMediator.additionalSortKey[this.contextName]) {
      for (i = 0; i < INTERMediator.additionalSortKey[this.contextName].length; i += 1) {
        oneSortKey = INTERMediator.additionalSortKey[this.contextName][i]
        if (!(oneSortKey.field in fields)) {
          fields.push(oneSortKey.field)
          directions.push(oneSortKey.direction)
        }
      }
    }
    condtextDef = this.getContextDef()
    if (condtextDef && condtextDef.sort) {
      for (i = 0; i < condtextDef.sort.length; i += 1) {
        oneSortKey = condtextDef.sort[i]
        if (!(oneSortKey.field in fields)) {
          fields.push(oneSortKey.field)
          directions.push(oneSortKey.direction)
        }
      }
    }
  } else {
    fields = ['field1', 'field2']
  }
  lower = 0
  upper = this.recordOrder.length
  for (i = 0; i < fields.length; i += 1) {
    if (oneRecord[fields[i]]) {
      index = parseInt((upper + lower) / 2)
      do {
        targetRecord = this.store[this.recordOrder[index]]
        contextValue = targetRecord[fields[i]]
        checkingValue = oneRecord[fields[i]]
        if (contextValue < checkingValue) {
          lower = index
        } else if (contextValue > checkingValue) {
          upper = index
        } else {
          lower = upper = index
        }
        index = parseInt((upper + lower) / 2)
      } while (upper - lower > 1)
      targetRecord = this.store[this.recordOrder[index]]
      contextValue = targetRecord[fields[i]]
      if (contextValue === checkingValue) {
        lower = upper = index
        stop = false
        do {
          targetRecord = this.store[this.recordOrder[lower - 1]]
          if (targetRecord && targetRecord[fields[i]] && targetRecord[fields[i]] === checkingValue) {
            lower--
          } else {
            stop = true
          }
        } while (!stop)
        stop = false
        do {
          targetRecord = this.store[this.recordOrder[upper + 1]]
          if (targetRecord && targetRecord[fields[i]] && targetRecord[fields[i]] === checkingValue) {
            upper++
          } else {
            stop = true
          }
        } while (!stop)
        if (lower === upper) {
          // index is the valid order number.
          break
        }
        upper++
      } else if (contextValue < checkingValue) {
        // index is the valid order number.
        break
      } else if (contextValue > checkingValue) {
        index--
        break
      }
    }
  }
  // if (isDebug === true) {
  //     console.log('#lower=' + lower + ',upper=' + upper + ',index=' + index +
  //         ',contextValue=' + contextValue + ',checkingValue=' + checkingValue)
  // }
  return index
}

/*
 * The isDebug parameter is for debugging and testing. Usually you should not specify it.
 */
IMLibContext.prototype.rearrangePendingOrder = function (isDebug) {
  'use strict'
  var i, index, targetRecord
  for (i = 0; i < this.pendingOrder.length; i += 1) {
    targetRecord = this.store[this.pendingOrder[i]]
    index = this.checkOrder(targetRecord, isDebug)
    if (index >= -1) {
      this.recordOrder.splice(index + 1, 0, this.pendingOrder[i])
    }
  }
  this.pendingOrder = []
}

IMLibContext.prototype.getRepeaterEndNode = function (index) {
  'use strict'
  var nodeId, field
  let repeaters = []
  let repeater, node, i, enclosure, children

  var recKey = this.recordOrder[index]
  for (field in this.binding[recKey]) {
    if (this.binding[recKey].hasOwnProperty(field)) {
      nodeId = this.binding[recKey][field].nodeId
      repeater = INTERMediatorLib.getParentRepeaters(document.getElementById(nodeId))
      for (i = 0; i < repeater.length; i += 1) {
        if (!(repeater[i] in repeaters)) {
          repeaters.push(repeater[i])
        }
      }
    }
  }
  if (repeaters.length < 1) {
    return null
  }
  node = repeaters[0]
  enclosure = INTERMediatorLib.getParentEnclosure(node)
  children = enclosure.childNodes
  for (i = 0; i < children.length; i += 1) {
    if (children[i] in repeaters) {
      node = repeaters[i]
      break
    }
  }
  return node
}

IMLibContext.prototype.storeRecords = function (records) {
  'use strict'
  var ix, record, field, keyField, keyValue
  var contextDef = INTERMediatorLib.getNamedObject(
    INTERMediatorOnPage.getDataSources(), 'name', this.contextName)
  keyField = contextDef.key ? contextDef.key : 'id'
  if (records.dbresult) {
    for (ix = 0; ix < records.dbresult.length; ix++) {
      record = records.dbresult[ix]
      for (field in record) {
        if (record.hasOwnProperty(field)) {
          keyValue = record[keyField] ? record[keyField] : ix
          this.setValue(keyField + '=' + keyValue, field, record[field])
        }
      }
    }
  }
}

IMLibContext.prototype.getDataAtLastRecord = function (key) {
  'use strict'
  var lastKey
  var storekeys = Object.keys(this.store)
  if (storekeys.length > 0) {
    lastKey = storekeys[storekeys.length - 1]
    return this.getValue(lastKey, key)
  }
  return undefined
}

// setData____ methods are for storing data both the model and the database.
//
IMLibContext.prototype.setDataAtLastRecord = function (key, value) {
  'use strict'
  var lastKey, keyAndValue, contextName
  var storekeys = Object.keys(this.store)
  if (storekeys.length > 0) {
    lastKey = storekeys[storekeys.length - 1]
    this.setValue(lastKey, key, value)
    contextName = this.contextName
    keyAndValue = lastKey.split('=')
    IMLibQueue.setTask((function () {
      var params = {
        name: contextName,
        conditions: [{field: keyAndValue[0], operator: '=', value: keyAndValue[1]}],
        dataset: [{field: key, value: value}]
      }
      return function (completeTask) {
        INTERMediator_DBAdapter.db_update(params)
        IMLibCalc.recalculation()
        INTERMediatorLog.flushMessage()
        completeTask()
      }
    })())
  }
}

IMLibContext.prototype.setDataWithKey = function (pkValue, key, value) {
  'use strict'
  var targetKey, contextDef, storeElements, contextName
  contextDef = this.getContextDef()
  if (!contextDef) {
    return
  }
  targetKey = contextDef.key + '=' + pkValue
  storeElements = this.store[targetKey]
  if (storeElements) {
    this.setValue(targetKey, key, value)
    contextName = this.contextName
    IMLibQueue.setTask((function () {
      var params = {
        name: contextName,
        conditions: [{field: contextDef.key, operator: '=', value: pkValue}],
        dataset: [{field: key, value: value}]
      }
      return function (completeTask) {
        INTERMediator_DBAdapter.db_update_async(
          params,
          (result) => {
            INTERMediatorLog.flushMessage()
            completeTask()
          },
          () => {
            INTERMediatorLog.flushMessage()
            completeTask()
          }
        )
      }
    })())
  }
}

IMLibContext.prototype.setValue = function (recKey, key, value, nodeId, target, portal) {
  'use strict'
  var updatedNodeIds = null
  if (portal) {
    /* eslint no-console: ["error", {allow: ["error"]}] */
    console.error('Using the portal parameter in IMLibContext.setValue')
  }
  if (recKey) {
    if (this.store[recKey] === undefined) {
      this.store[recKey] = {}
    }
    if (portal && this.store[recKey][key] === undefined) {
      this.store[recKey][key] = {}
    }
    if (this.binding[recKey] === undefined) {
      this.binding[recKey] = {}
      if (this.sequencing) {
        this.recordOrder.push(recKey)
      } else {
        this.pendingOrder.push(recKey)
      }
    }
    if (this.binding[recKey][key] === undefined) {
      this.binding[recKey][key] = []
    }
    if (portal && this.binding[recKey][key][portal] === undefined) {
      if (this.binding[recKey][key].length < 1) {
        this.binding[recKey][key] = {}
      }
      this.binding[recKey][key][portal] = []
    }
    if (key) {
      if (portal) {
        // this.store[recKey][key][portal] = value
        this.store[recKey][key] = value
      } else {
        this.store[recKey][key] = value
      }
      if (nodeId) {
        if (portal) {
          // this.binding[recKey][key][portal].push({id: nodeId, target: target})
          this.binding[recKey][key].push({id: nodeId, target: target})
        } else {
          this.binding[recKey][key].push({id: nodeId, target: target})
        }
        if (this.contextInfo[nodeId] === undefined) {
          this.contextInfo[nodeId] = {}
        }
        this.contextInfo[nodeId][target ? target : '_im_no_target'] =
          {context: this, record: recKey, field: key}
        if (portal) {
          this.contextInfo[nodeId][target ? target : '_im_no_target'].portal = portal
        }
      } else {
        if (INTERMediator.partialConstructing) {
          updatedNodeIds = IMLibContextPool.synchronize(this, recKey, key, value, target, portal)
        }
      }
    }
  }
  return updatedNodeIds
}

IMLibContext.prototype.getValue = function (recKey, key, portal) {
  'use strict'
  var value
  try {
    if (portal) {
      value = this.store[portal][key]
    } else {
      value = this.store[recKey][key]
    }
    if (Array.isArray(value)) {
      value = value.join()
    }
    return value === undefined ? null : value
  } catch (ex) {
    return null
  }
}

IMLibContext.prototype.isValueUndefined = function (recKey, key, portal) {
  'use strict'
  var value, tableOccurence, relatedRecId
  try {
    if (portal) {
      tableOccurence = key.split('::')[0]
      relatedRecId = portal.split('=')[1]
      value = this.store[recKey][0][tableOccurence][relatedRecId][key]
    } else {
      value = this.store[recKey][key]
    }
    return value === undefined ? true : false
  } catch (ex) {
    return null
  }
}

IMLibContext.prototype.getContextInfo = function (nodeId, target) {
  'use strict'
  try {
    var info = this.contextInfo[nodeId][target ? target : '_im_no_target']
    return info === undefined ? null : info
  } catch (ex) {
    return null
  }
}

IMLibContext.prototype.getContextValue = function (nodeId, target) {
  'use strict'
  try {
    var info = this.contextInfo[nodeId][target ? target : '_im_no_target']
    var value = info.context.getValue(info.record, info.field)
    return value === undefined ? null : value
  } catch (ex) {
    return null
  }
}

IMLibContext.prototype.getContextRecord = function (nodeId) {
  'use strict'
  var infos, keys, i
  try {
    infos = this.contextInfo[nodeId]
    keys = Object.keys(infos)
    for (i = 0; i < keys.length; i += 1) {
      if (infos[keys[i]]) {
        return this.store[infos[keys[i]].record]
      }
    }
    return null
  } catch (ex) {
    return null
  }
}

IMLibContext.prototype.removeEntry = function (pkvalue) {
  'use strict'
  var keyField, keying, bindingInfo, contextDef, targetNode, repeaterNodes, i
  let removingNodeIds = []
  contextDef = this.getContextDef()
  keyField = contextDef.key
  keying = keyField + '=' + pkvalue
  bindingInfo = this.binding[keying]
  if (bindingInfo) {
    repeaterNodes = bindingInfo._im_repeater
    if (repeaterNodes) {
      for (i = 0; i < repeaterNodes.length; i += 1) {
        removingNodeIds.push(repeaterNodes[i].id)
      }
    }
  }
  if (removingNodeIds.length > 0) {
    for (i = 0; i < removingNodeIds.length; i += 1) {
      IMLibContextPool.removeRecordFromPool(removingNodeIds[i])
    }
    for (i = 0; i < removingNodeIds.length; i += 1) {
      targetNode = document.getElementById(removingNodeIds[i])
      if (targetNode) {
        targetNode.parentNode.removeChild(targetNode)
      }
    }
  }
}

IMLibContext.prototype.isContaining = function (value) {
  'use strict'
  var contextDef, contextName
  let checkResult = []
  let i, fieldName, result, opePosition, leftHand, rightHand, leftResult, rightResult

  contextDef = this.getContextDef()
  contextName = contextDef.name
  if (contextDef.query) {
    for (i in contextDef.query) {
      if (contextDef.query.hasOwnProperty(i)) {
        checkResult.push(checkCondition(contextDef.query[i], value))
      }
    }
  }
  if (INTERMediator.additionalCondition[contextName]) {
    for (i = 0; i < INTERMediator.additionalCondition[contextName].length; i += 1) {
      checkResult.push(checkCondition(INTERMediator.additionalCondition[contextName][i], value))
    }
  }

  result = true
  if (checkResult.length !== 0) {
    opePosition = checkResult.indexOf('D')
    if (opePosition > -1) {
      leftHand = checkResult.slice(0, opePosition)
      rightHand = opePosition.slice(opePosition + 1)
      if (rightHand.length === 0) {
        result = (leftHand.indexOf(false) < 0)
      } else {
        leftResult = (leftHand.indexOf(false) < 0)
        rightResult = (rightHand.indexOf(false) < 0)
        result = leftResult || rightResult
      }
    } else {
      opePosition = checkResult.indexOf('EX')
      if (opePosition > -1) {
        leftHand = checkResult.slice(0, opePosition)
        rightHand = opePosition.slice(opePosition + 1)
        if (rightHand.length === 0) {
          result = (leftHand.indexOf(true) > -1)
        } else {
          leftResult = (leftHand.indexOf(true) > -1)
          rightResult = (rightHand.indexOf(true) > -1)
          result = leftResult && rightResult
        }
      } else {
        opePosition = checkResult.indexOf(false)
        if (opePosition > -1) {
          result = (checkResult.indexOf(false) < 0)
        }
      }
    }

    if (result === false) {
      return false
    }
  }

  if (this.foreignValue) {
    for (fieldName in this.foreignValue) {
      if (contextDef.relation) {
        for (i in contextDef.relation) {
          if (contextDef.relation[i]['join-field'] === fieldName) {
            result &= (checkCondition({
              field: contextDef.relation[i]['foreign-key'],
              operator: '=',
              value: this.foreignValue[fieldName]
            }, value))
          }
        }
      }
    }
  }

  return result

  function checkCondition (conditionDef, oneRecord) {
    var realValue

    if (conditionDef.field === '__operation__') {
      return conditionDef.operator === 'ex' ? 'EX' : 'D'
    }

    realValue = oneRecord[conditionDef.field]
    if (!realValue) {
      return false
    }
    switch (conditionDef.operator) {
      case '=':
      case 'eq':
        return String(realValue) === String(conditionDef.value)
      case '>':
      case 'gt':
        return realValue > conditionDef.value
      case '<':
      case 'lt':
        return realValue < conditionDef.value
      case '>=':
      case 'gte':
        return realValue >= conditionDef.value
      case '<=':
      case 'lte':
        return realValue <= conditionDef.value
      case '!=':
      case 'neq':
        return String(realValue) !== String(conditionDef.value)
      default:
        return false
    }
  }
}

IMLibContext.prototype.insertEntry = function (pkvalue, fields, values) {
  'use strict'
  var i, field, value
  for (i = 0; i < fields.length; i += 1) {
    field = fields[i]
    value = values[i]
    this.setValue(pkvalue, field, value)
  }
}

/**
 *
 * Usually you don't have to instanciate this class with new operator.
 * @constructor
 */
var IMLibLocalContext = {
  contextName: '_',
  store: {},
  binding: {},

  clearAll: function () {
    'use strict'
    this.store = {}
  },

  setValue: function (key, value, withoutArchive) {
    'use strict'
    var i, hasUpdated, refIds, node

    hasUpdated = false
    if (key) {
      if (value === undefined || value === null) {
        delete this.store[key]
      } else {
        this.store[key] = value
        hasUpdated = true
        refIds = this.binding[key]
        if (refIds) {
          for (i = 0; i < refIds.length; i += 1) {
            node = document.getElementById(refIds[i])
            IMLibElement.setValueToIMNode(node, '', value, true)
          }
        }
      }
    }
    if (hasUpdated && withoutArchive !== true) {
      this.archive()
    }
  },

  getValue: function (key) {
    'use strict'
    var value = this.store[key]
    return value === undefined ? null : value
  },

  archive: function () {
    'use strict'
    var jsonString, key, searchLen, hashLen, trailLen
    INTERMediatorOnPage.removeCookie('_im_localcontext')
    if (INTERMediator.isIE && INTERMediator.ieVersion < 9) {
      this.store._im_additionalCondition = INTERMediator.additionalCondition
      this.store._im_additionalSortKey = INTERMediator.additionalSortKey
      this.store._im_startFrom = INTERMediator.startFrom
      this.store._im_pagedSize = INTERMediator.pagedSize
      /*
       IE8 issue: '' string is modified as 'null' on JSON stringify.
       http://blogs.msdn.com/b/jscript/archive/2009/06/23/serializing-the-value-of-empty-dom-elements-using-native-json-in-ie8.aspx
       */
      jsonString = JSON.stringify(this.store, function (k, v) {
        return v === '' ? '' : v
      })
    } else {
      jsonString = JSON.stringify(this.store)
    }
    if (INTERMediator.useSessionStorage === true &&
      typeof sessionStorage !== 'undefined' &&
      sessionStorage !== null) {
      try {
        searchLen = location.search ? location.search.length : 0
        hashLen = location.hash ? location.hash.length : 0
        trailLen = searchLen + hashLen
        key = '_im_localcontext' + document.URL.toString()
        key = (trailLen > 0) ? key.slice(0, -trailLen) : key
        sessionStorage.setItem(key, jsonString)
      } catch (ex) {
        INTERMediatorOnPage.setCookieWorker('_im_localcontext', jsonString, false, 0)
      }
    } else {
      INTERMediatorOnPage.setCookieWorker('_im_localcontext', jsonString, false, 0)
    }
  },

  unarchive: function () {
    'use strict'
    var localContext = ''
    let searchLen, hashLen, key, trailLen
    if (INTERMediator.useSessionStorage === true &&
      typeof sessionStorage !== 'undefined' &&
      sessionStorage !== null) {
      try {
        searchLen = location.search ? location.search.length : 0
        hashLen = location.hash ? location.hash.length : 0
        trailLen = searchLen + hashLen
        key = '_im_localcontext' + document.URL.toString()
        key = (trailLen > 0) ? key.slice(0, -trailLen) : key
        localContext = sessionStorage.getItem(key)
      } catch (ex) {
        localContext = INTERMediatorOnPage.getCookie('_im_localcontext')
      }
    } else {
      localContext = INTERMediatorOnPage.getCookie('_im_localcontext')
    }
    if (localContext && localContext.length > 0) {
      this.store = JSON.parse(localContext)
      if (INTERMediator.isIE && INTERMediator.ieVersion < 9) {
        if (this.store._im_additionalCondition) {
          INTERMediator.additionalCondition = this.store._im_additionalCondition
        }
        if (this.store._im_additionalSortKey) {
          INTERMediator.additionalSortKey = this.store._im_additionalSortKey
        }
        if (this.store._im_startFrom) {
          INTERMediator.startFrom = this.store._im_startFrom
        }
        if (this.store._im_pagedSize) {
          INTERMediator.pagedSize = this.store._im_pagedSize
        }
      }
      this.updateAll(true)
    }
  },

  bindingNode: function (node) {
    'use strict'
    var linkInfos, nodeInfo, idValue, i, j, value, params, unbinding, unexistId, dataImControl
    if (node.nodeType !== 1) {
      return
    }
    linkInfos = INTERMediatorLib.getLinkedElementInfo(node)
    dataImControl = node.getAttribute('data-im-control')
    unbinding = (dataImControl && dataImControl === 'unbind')
    for (i = 0; i < linkInfos.length; i += 1) {
      nodeInfo = INTERMediatorLib.getNodeInfoArray(linkInfos[i])
      if (nodeInfo.table === this.contextName) {
        if (!node.id) {
          node.id = INTERMediator.nextIdValue()
        }
        idValue = node.id
        if (!this.binding[nodeInfo.field]) {
          this.binding[nodeInfo.field] = []
        }
        if (this.binding[nodeInfo.field].indexOf(idValue) < 0 && !unbinding) {
          this.binding[nodeInfo.field].push(idValue)
          // this.store[nodeInfo.field] = document.getElementById(idValue).value
        }
        unexistId = -1
        while (unexistId >= 0) {
          for (j = 0; j < this.binding[nodeInfo.field].length; j++) {
            if (!document.getElementById(this.binding[nodeInfo.field][j])) {
              unexistId = j
            }
          }
          if (unexistId >= 0) {
            delete this.binding[nodeInfo.field][unexistId]
          }
        }

        value = this.store[nodeInfo.field]
        IMLibElement.setValueToIMNode(node, nodeInfo.target, value, true)

        params = nodeInfo.field.split(':')
        switch (params[0]) {
          case 'addorder':
            IMLibMouseEventDispatch.setExecute(idValue, IMLibUI.eventAddOrderHandler)
            break
          case 'update':
            IMLibMouseEventDispatch.setExecute(idValue, (function () {
              var contextName = params[1]
              return async function () {
                INTERMediator.startFrom = 0
                await IMLibUI.eventUpdateHandler(contextName)
                IMLibPageNavigation.navigationSetup()
              }
            })())
            break
          case 'condition':
            var attrType = node.getAttribute('type')
            if (attrType && attrType === 'text') {
              IMLibKeyDownEventDispatch.setExecuteByCode(idValue, 13, (function () {
                var contextName = params[1]
                return async function () {
                  INTERMediator.startFrom = 0
                  await IMLibUI.eventUpdateHandler(contextName)
                  IMLibPageNavigation.navigationSetup()
                }
              })())
            } else if (attrType && (attrType === 'checkbox' || attrType === 'radio')) {
              IMLibChangeEventDispatch.setExecute(idValue, (function () {
                var contextName = params[1]
                return async function () {
                  INTERMediator.startFrom = 0
                  await IMLibUI.eventUpdateHandler(contextName)
                  IMLibPageNavigation.navigationSetup()
                }
              })())
            }
            break
          case 'limitnumber':
            if (node.value) {
              this.store[nodeInfo.field] = node.value
            }
            IMLibChangeEventDispatch.setExecute(idValue, (function () {
              var contextName = params[1]
              return async function () {
                await IMLibUI.eventUpdateHandler(contextName)
                IMLibPageNavigation.navigationSetup()
              }
            })())
            node.setAttribute('data-imchangeadded', 'set')
            break
          default:
            IMLibChangeEventDispatch.setExecute(idValue, IMLibLocalContext.update)
            break
        }
      }
    }
  },

  update: function (idValue) {
    'use strict'
    IMLibLocalContext.updateFromNodeValue(idValue)
  },

  updateFromNodeValue: function (idValue) {
    'use strict'
    var node, nodeValue, linkInfos, nodeInfo, i
    node = document.getElementById(idValue)
    nodeValue = IMLibElement.getValueFromIMNode(node)
    linkInfos = INTERMediatorLib.getLinkedElementInfo(node)
    for (i = 0; i < linkInfos.length; i += 1) {
      IMLibLocalContext.store[linkInfos[i]] = nodeValue
      nodeInfo = INTERMediatorLib.getNodeInfoArray(linkInfos[i])
      if (nodeInfo.table === IMLibLocalContext.contextName) {
        IMLibLocalContext.setValue(nodeInfo.field, nodeValue)
      }
    }
  },

  updateFromStore: function (idValue) {
    'use strict'
    var node, nodeValue, linkInfos, nodeInfo, i, target, comp
    node = document.getElementById(idValue)
    target = node.getAttribute('data-im')
    comp = target.split(INTERMediator.separator)
    if (comp[1]) {
      nodeValue = IMLibLocalContext.store[comp[1]]
      linkInfos = INTERMediatorLib.getLinkedElementInfo(node)
      for (i = 0; i < linkInfos.length; i += 1) {
        IMLibLocalContext.store[linkInfos[i]] = nodeValue
        nodeInfo = INTERMediatorLib.getNodeInfoArray(linkInfos[i])
        if (nodeInfo.table === IMLibLocalContext.contextName) {
          IMLibLocalContext.setValue(nodeInfo.field, nodeValue)
        }
      }
    }
  },

  updateAll: function (isStore) {
    'use strict'
    var index, key, nodeIds, idValue, targetNode
    for (key in IMLibLocalContext.binding) {
      if (IMLibLocalContext.binding.hasOwnProperty(key)) {
        nodeIds = IMLibLocalContext.binding[key]
        for (index = 0; index < nodeIds.length; index++) {
          idValue = nodeIds[index]
          targetNode = document.getElementById(idValue)
          if (targetNode &&
            (targetNode.tagName === 'INPUT' ||
            targetNode.tagName === 'TEXTAREA' ||
            targetNode.tagName === 'SELECT')) {
            if (isStore === true) {
              IMLibLocalContext.updateFromStore(idValue)
            } else {
              IMLibLocalContext.updateFromNodeValue(idValue)
            }
            break
          }
        }
      }
    }
  },

  checkedBinding: [],

  bindingDescendant: function (rootNode) {
    'use strict'
    var self = this
    seek(rootNode)
    IMLibLocalContext.checkedBinding.push(rootNode)

    function seek (node) {
      var children, i
      if (node !== rootNode && IMLibLocalContext.checkedBinding.indexOf(node) > -1) {
        return // Stop on already checked enclosure nodes.
      }
      if (node.nodeType === 1) { // Work for an element
        try {
          self.bindingNode(node)
          children = node.childNodes // Check all child nodes.
          if (children) {
            for (i = 0; i < children.length; i += 1) {
              seek(children[i])
            }
          }
        } catch (ex) {
          if (ex.message === '_im_auth_required_') {
            throw ex
          } else {
            INTERMediatorLog.setErrorMessage(ex, 'EXCEPTION-31')
          }
        }
      }
    }
  }
}
