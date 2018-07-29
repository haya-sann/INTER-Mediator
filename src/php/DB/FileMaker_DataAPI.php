<?php
/**
 * INTER-Mediator
 * Copyright (c) INTER-Mediator Directive Committee (http://inter-mediator.org)
 * This project started at the end of 2009 by Masayuki Nii msyk@msyk.net.
 *
 * INTER-Mediator is supplied under MIT License.
 * Please see the full license for details:
 * https://github.com/INTER-Mediator/INTER-Mediator/blob/master/dist-docs/License.txt
 *
 * @copyright     Copyright (c) INTER-Mediator Directive Committee (http://inter-mediator.org)
 * @link          https://inter-mediator.com/
 * @license       http://www.opensource.org/licenses/mit-license.php MIT License
 */

namespace INTERMediator\DB;

class FileMaker_DataAPI extends UseSharedObjects implements DBClass_Interface
{
    public $fmData = null;     // FMDataAPI class's instance
    public $fmDataAuth = null; // FMDataAPI class's instance
    public $fmDataAlt = null;  // FMDataAPI class's instance
    private $targetLayout = null;
    private $recordCount = null;
    private $mainTableCount = 0;
    private $mainTableTotalCount = 0;
    private $fieldInfo = null;

    private $isRequiredUpdated = false;
    private $updatedRecord = null;
    private $softDeleteField = null;
    private $softDeleteValue = null;

    /**
     * @param $str
     */
    public function errorMessageStore($str)
    {
        $this->logger->setErrorMessage("Query Error: [{$str}] Error Code={$this->fmData->errorCode()}");
    }

    public function setupConnection()
    {
        return true;
    }

    public function requireUpdatedRecord($value)
    {
        // always can get the new record for FileMaker Server.
    }

    public function updatedRecord()
    {
        return $this->updatedRecord;
    }

    public function setUpdatedRecord($field, $value, $index = 0)
    {
        $this->updatedRecord[$index][$field] = $value;
    }

    public function softDeleteActivate($field, $value)
    {
        $this->softDeleteField = $field;
        $this->softDeleteValue = $value;
    }

    public function setupFMDataAPIforAuth($layoutName, $recordCount)
    {
        $this->fmData = null;
        $this->fmDataAuth = $this->setupFMDataAPI_Impl($layoutName, $recordCount,
            $this->dbSettings->getDbSpecUser(), $this->dbSettings->getDbSpecPassword());
    }

    public function setupFMDataAPIforDB($layoutName, $recordCount)
    {
        $this->fmDataAuth = null;
        $this->fmData = $this->setupFMDataAPI_Impl($layoutName, $recordCount,
            $this->dbSettings->getAccessUser(), $this->dbSettings->getAccessPassword());
    }

    public function setupFMDataAPIforDB_Alt($layoutName, $recordCount)
    {
        $this->fmDataAlt = $this->setupFMDataAPI_Impl($layoutName, $recordCount,
            $this->dbSettings->getAccessUser(), $this->dbSettings->getAccessPassword());
    }

    private function setupFMDataAPI_Impl($layoutName, $recordCount, $user, $password)
    {
        $this->targetLayout = $layoutName;
        $this->recordCount = $recordCount;
        if(!isset($_SESSION)){
            session_start();
        }
        $token = isset($_SESSION['X-FM-Data-Access-Token']) ? $_SESSION['X-FM-Data-Access-Token'] : '';
        try {
            if ($token === '') {
                throw new \Exception();
            }
            $fmDataObj = new \INTERMediator\FileMakerServer\RESTAPI\FMDataAPI(
                $this->dbSettings->getDbSpecDatabase(),
                '',
                '',
                $this->dbSettings->getDbSpecServer(),
                $this->dbSettings->getDbSpecPort(),
                $this->dbSettings->getDbSpecProtocol()
            );
            $fmDataObj->setSessionToken($token);
            $fmDataObj->setCertValidating(true);
            $fmDataObj->{$layoutName}->startCommunication();
            $fmDataObj->{$layoutName}->query(NULL, NULL, -1, 1);
        } catch (\Exception $e) {
            $fmDataObj = new \INTERMediator\FileMakerServer\RESTAPI\FMDataAPI(
                $this->dbSettings->getDbSpecDatabase(),
                $user,
                $password,
                $this->dbSettings->getDbSpecServer(),
                $this->dbSettings->getDbSpecPort(),
                $this->dbSettings->getDbSpecProtocol()
            );
            $fmDataObj->setCertValidating(true);
            $fmDataObj->{$layoutName}->startCommunication();
        }
        return $fmDataObj;
    }

    public function setupHandlers($dsn = false)
    {
        $this->authHandler = new Support\DB_Auth_Handler_FileMaker_DataAPI($this);
        $this->notifyHandler = new Support\DB_Notification_Handler_FileMaker_DataAPI($this);
        $this->specHandler = new Support\DB_Spec_Handler_FileMaker_DataAPI();
    }

    public function stringWithoutCredential($str)
    {
        if (is_null($this->fmData)) {
            $str = str_replace($this->dbSettings->getDbSpecUser(), "********", $str);
            return str_replace($this->dbSettings->getDbSpecPassword(), "********", $str);
        } else {
            $str = str_replace($this->dbSettings->getAccessUser(), "********", $str);
            return str_replace($this->dbSettings->getAccessPassword(), "********", $str);
        }
    }

    private function stringReturnOnly($str)
    {
        return str_replace("\n\r", "\r", str_replace("\n", "\r", $str));
    }

    private function unifyCRLF($str)
    {
        return str_replace("\n", "\r", str_replace("\r\n", "\r", $str));
    }


    private function setSearchConditionsForCompoundFound($field, $value, $operator = NULL)
    {
        if ($operator === NULL) {
            return array($field, $value);
        } else if ($operator === 'eq' || $operator === 'neq') {
            return array($field, '=' . $value);
        } else if ($operator === 'cn') {
            return array($field, '*' . $value . '*');
        } else if ($operator === 'bw') {
            return array($field, $value . '*');
        } else if ($operator === 'ew') {
            return array($field, '*' . $value);
        } else if ($operator === 'gt') {
            return array($field, '>' . $value);
        } else if ($operator === 'gte') {
            return array($field, '>=' . $value);
        } else if ($operator === 'lt') {
            return array($field, '<' . $value);
        } else if ($operator === 'lte') {
            return array($field, '<=' . $value);
        }
    }

    private function executeScripts($scriptContext)
    {
        $script = array();
        if (is_array($scriptContext)) {
            foreach ($scriptContext as $condition) {
                if (isset($condition['situation']) &&
                    isset($condition['definition']) && !empty($condition['definition'])
                ) {
                    $scriptName = str_replace('&', '', $condition['definition']);
                    $parameter = '';
                    if (isset($condition['parameter']) && !empty($condition['parameter'])) {
                        $parameter = str_replace('&', '', $condition['parameter']);
                    }
                    switch ($condition['situation']) {
                        case 'post':
                            $script = $script + array('script' => $scriptName);
                            if ($parameter !== '') {
                                $script = $script + array('script.param' => $parameter);
                            }
                            break;
                        case 'pre':
                            $script = $script + array('script.prerequest' => $scriptName);
                            if ($parameter !== '') {
                                $script = $script + array('script.prerequest.param' => $parameter);
                            }
                            break;
                        case 'presort':
                            $script = $script + array('script.presort' => $scriptName);
                            if ($parameter !== '') {
                                $script = $script + array('script.presort.param' => $parameter);
                            }
                            break;
                    }
                }
            }
        }

        return $script === array() ? NULL : $script;
    }

    public function getFieldInfo($dataSourceName)
    {
        return $this->fieldInfo;
    }

    public function getSchema($dataSourceName)
    {
        $this->fieldInfo = null;

        $this->setupFMDataAPIforDB($this->dbSettings->getEntityForRetrieve(), '');
        $layout = $this->targetLayout;
        $result = $this->fmData->{$layout}->query(NULL, NULL, 1, 1);

        $portal = array();
        if (!is_null($result)) {
            $portalNames = $result->getPortalNames();
            if (count($portalNames) >= 1) {
                foreach ($portalNames as $key => $portalName) {
                    $portal = array_merge($portal, array($key => $portalName));
                }
                $result = $this->fmData->{$layout}->query(NULL, NULL, 1, 1, $portal);
            }
        }

        if (get_class($result) !== 'INTERMediator\\FileMakerServer\\RESTAPI\\Supporting\\FileMakerRelation') {
            if ($this->dbSettings->isDBNative()) {
                $this->dbSettings->setRequireAuthentication(true);
            } else {
                $this->logger->setErrorMessage(
                    $this->stringWithoutCredential(get_class($result) . ': ' . $result->getDebugInfo()));
            }
            return false;
        }

        $returnArray = array();
        foreach ($result->getFieldNames() as $key => $fieldName) {
            $returnArray[$fieldName] = '';
        }

        return $returnArray;
    }

    public function readFromDB()
    {
        $useOrOperation = FALSE;
        $this->fieldInfo = NULL;
        $this->mainTableCount = 0;
        $this->mainTableTotalCount = 0;
        $context = $this->dbSettings->getDataSourceTargetArray();
        $tableName = $this->dbSettings->getEntityForRetrieve();
        $dataSourceName = $this->dbSettings->getDataSourceName();

        $usePortal = FALSE;
        if (count($this->dbSettings->getForeignFieldAndValue()) > 0) {
            foreach ($context['relation'] as $relDef) {
                if (isset($relDef['portal']) && $relDef['portal']) {
                    $usePortal = TRUE;
                    $context['records'] = 1;
                    $context['paging'] = TRUE;
                }
            }
        }

        $limitParam = 100000000;
        if (isset($context['maxrecords'])) {
            if (intval($context['maxrecords']) < $this->dbSettings->getRecordCount()) {
                if (intval($context['maxrecords']) < intval($context['records'])) {
                    $limitParam = intval($context['records']);
                } else {
                    $limitParam = intval($context['maxrecords']);
                }
            } else {
                $limitParam = $this->dbSettings->getRecordCount();
            }
        } else if (isset($context['records'])) {
            if (intval($context['records']) < $this->dbSettings->getRecordCount()) {
                $limitParam = intval($context['records']);
            } else {
                $limitParam = $this->dbSettings->getRecordCount();
            }
        }
        $this->setupFMDataAPIforDB($this->dbSettings->getEntityForRetrieve(), $limitParam);
        $layout = $this->targetLayout;
        $skip = (isset($context['paging']) and $context['paging'] === true) ? $this->dbSettings->getStart() : 0;

        $searchConditions = array();
        $neqConditions = array();

        $hasFindParams = false;
        if (isset($context['query'])) {
            foreach ($context['query'] as $condition) {
                if ($condition['field'] == '__operation__' && $condition['operator'] == 'or') {
                    $useOrOperation = true;
                } else {
                    if (isset($condition['operator'])) {
                        $condition = $this->normalizedCondition($condition);
                        if (!$this->specHandler->isPossibleOperator($condition['operator'])) {
                            throw new \Exception("Invalid Operator.: {$condition['operator']}");
                        }
                        // [WIP] $this->fmData->AddDBParam($condition['field'], $condition['value'], $condition['operator']);
                        $searchConditions[] = $this->setSearchConditionsForCompoundFound(
                            $condition['field'], $condition['value'], $condition['operator']);
                    } else {
                        // [WIP] $this->fmData->AddDBParam($condition['field'], $condition['value']);
                        $searchConditions[] = $this->setSearchConditionsForCompoundFound(
                            $condition['field'], $condition['value']);
                    }
                    $hasFindParams = true;

                    // [WIP]
                    if (isset($condition['operator']) && $condition['operator'] === 'neq') {
                        $neqConditions[] = TRUE;
                    } else {
                        $neqConditions[] = FALSE;
                    }
                }
            }
        }

        $childRecordId = null;
        $childRecordIdValue = null;
        if ($this->dbSettings->getExtraCriteria()) {
            foreach ($this->dbSettings->getExtraCriteria() as $condition) {
                if ($condition['field'] == '__operation__' && strtolower($condition['operator']) == 'or') {
                    $useOrOperation = true;
                } else if ($condition['field'] == '__operation__' && strtolower($condition['operator']) == 'ex') {
                    $useOrOperation = true;
                } else {
                    $condition = $this->normalizedCondition($condition);
                    if (!$this->specHandler->isPossibleOperator($condition['operator'])) {
                        throw new \Exception("Invalid Operator.: {$condition['field']}/{$condition['operator']}");
                    }

                    $tableInfo = $this->dbSettings->getDataSourceTargetArray();
                    $primaryKey = isset($tableInfo['key']) ? $tableInfo['key'] : $this->specHandler->getDefaultKey();
                    if ($condition['field'] == $primaryKey && isset($condition['value'])) {
                        $this->notifyHandler->setQueriedPrimaryKeys(array($condition['value']));
                    }

                    // [WIP] $this->fmData->AddDBParam($condition['field'], $condition['value'], $condition['operator']);
                    $searchConditions[] = $this->setSearchConditionsForCompoundFound(
                        $condition['field'], $condition['value'], $condition['operator']);
                    
                    if (isset($condition['operator']) && $condition['operator'] === 'neq') {
                        $neqConditions[] = TRUE;
                    } else {
                        $neqConditions[] = FALSE;
                    }

                    $hasFindParams = true;
                    if ($condition['field'] == $this->specHandler->getDefaultKey()) {
                        // [WIP] $this->fmData->FMSkipRecords(0);
                    }
                }
            }
        }

        if (count($this->dbSettings->getForeignFieldAndValue()) > 0) {
            foreach ($context['relation'] as $relDef) {
                foreach ($this->dbSettings->getForeignFieldAndValue() as $foreignDef) {
                    if (isset($relDef['join-field']) && $relDef['join-field'] == $foreignDef['field']) {
                        $foreignField = $relDef['foreign-key'];
                        $foreignValue = $foreignDef['value'];
                        $relDef = $this->normalizedCondition($relDef);
                        $foreignOperator = isset($relDef['operator']) ? $relDef['operator'] : 'eq';
                        $formattedValue = $this->formatter->formatterToDB(
                            "{$tableName}{$this->dbSettings->getSeparator()}{$foreignField}", $foreignValue);
                        // [WIP] if (!$this->specHandler->isPossibleOperator($foreignOperator)) {
                        //    throw new \Exception"Invalid Operator.: {$condition['operator']}");
                        //}
                        if ($useOrOperation) {
                            throw new \Exception("Condition Incompatible.: The OR operation and foreign key can't set both on the query. This is the limitation of the Custom Web of FileMaker Server.");
                        }
                        // [WIP] $this->fmData->AddDBParam($foreignField, $formattedValue, $foreignOperator);
                        $searchConditions[] = $this->setSearchConditionsForCompoundFound(
                            $foreignField, $formattedValue, $foreignOperator);
                        $hasFindParams = true;

                        if (isset($foreignOperator) && $foreignOperator === 'neq') {
                            $neqConditions[] = TRUE;
                        } else {
                            $neqConditions[] = FALSE;
                        }
                    }
                }
            }
        }

        if (isset($context['authentication'])
            && ((isset($context['authentication']['all'])
                || isset($context['authentication']["read"])
                || isset($context['authentication']["select"])
                || isset($context['authentication']["load"])))
        ) {
            $authFailure = FALSE;
            $authInfoField = $this->authHandler->getFieldForAuthorization("read");
            $authInfoTarget = $this->authHandler->getTargetForAuthorization("read");
            if ($authInfoTarget == 'field-user') {
                if (strlen($this->dbSettings->getCurrentUser()) == 0) {
                    $authFailure = true;
                } else {
                    if ($useOrOperation) {
                        throw new \Exception("Condition Incompatible.: The authorization for each record and OR operation can't set both on the query. This is the limitation of the Custom Web of FileMaker Server.");
                    }
                    $signedUser = $this->authHandler->authSupportUnifyUsernameAndEmail($this->dbSettings->getCurrentUser());
                    $this->fmData->AddDBParam($authInfoField, $signedUser, 'eq');
                    $searchConditions[] = $this->setSearchConditionsForCompoundFound(
                        $authInfoField, $signedUser, 'eq');
                    $hasFindParams = true;

                    $neqConditions[] = FALSE;
                }
            } else
                if ($authInfoTarget == 'field-group') {
                    $belongGroups = $this->authHandler->authSupportGetGroupsOfUser($this->dbSettings->getCurrentUser());
                    if (strlen($this->dbSettings->getCurrentUser()) == 0 || count($belongGroups) == 0) {
                        $authFailure = true;
                    } else {
                        if ($useOrOperation) {
                            throw new \Exception("Condition Incompatible.: The authorization for each record and OR operation can't set both on the query. This is the limitation of the Custom Web of FileMaker Server.");
                        }
                        $this->fmData->AddDBParam($authInfoField, $belongGroups[0], 'eq');
                        $searchConditions[] = $this->setSearchConditionsForCompoundFound(
                            $authInfoField, $belongGroups[0], 'eq');
                        $hasFindParams = true;

                        $neqConditions[] = FALSE;
                    }
                }
            if ($authFailure) {
                $this->logger->setErrorMessage("Authorization Error.");
                return null;
            }
        }

        if (!is_null($this->softDeleteField) && !is_null($this->softDeleteValue)) {
            if ($useOrOperation) {
                throw new \Exception("Condition Incompatible.: The soft-delete record and OR operation can't set both on the query. This is the limitation of the Custom Web of FileMaker Server.");
            }
            // [WIP]
            $this->fmData->AddDBParam($this->softDeleteField, $this->softDeleteValue, 'neq');
            $searchConditions[] = $this->setSearchConditionsForCompoundFound(
                $this->softDeleteField, $this->softDeleteValue, 'eq');
            $hasFindParams = true;

            $neqConditions[] = FALSE;
        }

        $sort = array();
        if (isset($context['sort'])) {
            foreach ($context['sort'] as $condition) {
                if (isset($condition['direction'])) {
                    if (!$this->specHandler->isPossibleOrderSpecifier($condition['direction'])) {
                        throw new \Exception("Invalid Sort Specifier.");
                    }
                    $sort[] = array($condition['field'], $this->_adjustSortDirection($condition['direction']));
                } else {
                    $sort[] = array($condition['field']);
                }
            }
        }
        if ($sort === array()) {
            $sort = NULL;
        }

        $conditions = array();
        if ($searchConditions !== array()) {
            if ($useOrOperation === TRUE) {
                $i = 0;
                foreach ($searchConditions as $searchCondition) {
                    if ($neqConditions[$i] === TRUE) {
                        $conditions[] = array(
                            $searchCondition[0] => $searchCondition[1],
                            'omit' => 'true'
                        );
                    } else {
                        $conditions[] = array($searchCondition[0] => $searchCondition[1]);
                    }
                    $i++;
                }
            } else {
                $tmpCondition = array();
                $i = 0;
                foreach ($searchConditions as $searchCondition) {
                    if ($neqConditions[$i] === TRUE) {
                        $conditions[] = $tmpCondition;
                        $tmpCondition = array();
                        $conditions[] = array(
                            $searchCondition[0] => $searchCondition[1],
                            'omit' => 'true'
                        );
                    } else {
                        $tmpCondition[$searchCondition[0]] = $searchCondition[1];
                    }
                    $i++;
                }
                if ($tmpCondition !== array()) {
                    $conditions[] = $tmpCondition;
                }
            }
        }
        if ($conditions === array()) {
            $conditions = NULL;
        }

        if (isset($tableInfo['global'])) {
            foreach ($tableInfo['global'] as $condition) {
                if (isset($condition['db-operation']) && in_array($condition['db-operation'], array('load', 'read'))) {
                    $this->fmData->{$layout}->setGlobalField(
                        array($condition['field'] => $condition['value'])
                    );
                }
            }
        }

        $script = NULL;
        if (isset($context['script'])) {
            foreach ($context['script'] as $condition) {
                if (isset($condition['db-operation']) && in_array($condition['db-operation'], array('load', 'read'))) {
                    $script = $this->executeScripts($context['script']);
                }
            }
        }

        $request = filter_input_array(INPUT_POST);
        if (!is_null($request)) {
            foreach ($request as $key => $val) {
                if (substr($key, 0, 7) === 'sortkey' && substr($key, -5, 5) === 'field') {
                    $orderNum = substr($key, 7, 1);
                    if (isset($request['sortkey' . $orderNum . 'direction'])) {
                        $sortDirection = $request['sortkey' . $orderNum . 'direction'];
                    }
                    if ($sort === NULL) {
                        $sort = array(array($val, $sortDirection));
                    }
                }
            }
        }

        $portal = array();
        $portalNames = array();
        $recordId = NULL;
        $result = NULL;
        $scriptResultPrerequest = NULL;
        $scriptResultPresort = NULL;
        $scriptResult = NULL;
        try {
            if (count($conditions) === 1 && isset($conditions[0]['recordId'])) {
                $recordId = str_replace('=', '', $conditions[0]['recordId']);
                if (is_numeric($recordId)) {
                    $conditions[0]['recordId'] = $recordId;
                    $result = $this->fmData->{$layout}->getRecord($recordId);
                }
            } else {
                $result = $this->fmData->{$layout}->query($conditions, $sort, $skip + 1, 1);
            }

            $this->notifyHandler->setQueriedEntity($layout);
            $this->notifyHandler->setQueriedCondition("/fmi/rest/api/find/{$this->dbSettings->getDbSpecDatabase()}/{$layout}" . ($recordId ? "/{$recordId}" : ""));            

            if (!is_null($result)) {
                $portalNames = $result->getPortalNames();
                if (count($portalNames) >= 1) {
                    foreach ($portalNames as $key => $portalName) {
                        $portal = array_merge($portal, array($key => $portalName));
                    }
                    if (!is_numeric($recordId)) {
                        $result = $this->fmData->{$layout}->query(
                            $conditions,
                            $sort,
                            $skip + 1,
                            $limitParam,
                            $portal,
                            $script
                        );
                        $scriptResultPrerequest = $this->fmData->{$layout}->getScriptResultPrerequest();
                        $scriptResultPresort = $this->fmData->{$layout}->getScriptResultPresort();
                        $scriptResult = $this->fmData->{$layout}->getScriptResult();
                    }
                } else {
                    $result = $this->fmData->{$layout}->query(
                        $conditions,
                        $sort,
                        $skip + 1,
                        $limitParam,
                        $portal,
                        $script
                    );
                    $scriptResultPrerequest = $this->fmData->{$layout}->getScriptResultPrerequest();
                    $scriptResultPresort = $this->fmData->{$layout}->getScriptResultPresort();
                    $scriptResult = $this->fmData->{$layout}->getScriptResult();
                }
            }
        } catch (\Exception $e) {
            // Don't output error messages if no related records
            if (strpos($e->getMessage(), 'Error Code: 401, Error Message: No records match the request') === false) {
                $this->logger->setErrorMessage("Exception: {$e->getMessage()}");
            }
        }

        $recordArray = array();
        if (!is_null($result)) {
            foreach ($result as $record) {
                $dataArray = array();
                if (!$usePortal) {
                    $dataArray = $dataArray + array(
                        'recordId' => $record->getRecordId(),
                    );
                }
                foreach ($result->getFieldNames() as $key => $fieldName) {
                    $dataArray = $dataArray + array(
                        $fieldName => $this->formatter->formatterFromDB(
                            $this->getFieldForFormatter($tableName, $fieldName), strval($record->{$fieldName})
                        )
                    );
                }
                
                $relatedsetArray = array();
                if (count($portalNames) >= 1) {
                    $relatedArray = array();
                    foreach ($portalNames as $key => $portalName) {
                        foreach ($result->{$portalName} as $portalRecord) {
                            $recId = $portalRecord->getRecordId();
                            foreach ($result->{$portalName}->getFieldNames() as $key => $relatedFieldName) {
                                if (strpos($relatedFieldName, '::') !== false) {
                                    $dotPos = strpos($relatedFieldName, '::');
                                    $tableOccurrence = substr($relatedFieldName, 0, $dotPos);
                                    if (!isset($relatedArray[$tableOccurrence][$recId])) {
                                        $relatedArray[$tableOccurrence][$recId] = array('recordId' => $recId);
                                    }
                                    if ($relatedFieldName !== 'recordId') {
                                        $relatedArray[$tableOccurrence][$recId] += array(
                                            $relatedFieldName =>                                     
                                                $this->formatter->formatterFromDB(
                                                    "{$tableOccurrence}{$this->dbSettings->getSeparator()}{$relatedFieldName}",
                                                    $portalRecord->{$relatedFieldName}
                                            )
                                        );
                                    }
                                }
                            }
                        }
                        $relatedsetArray = array($relatedArray);
                    }
                }

                foreach ($relatedsetArray as $j => $relatedset) {
                    $dataArray = $dataArray + array($j => $relatedset);
                }
                if ($usePortal) {
                    $recordArray = $dataArray;
                    $this->mainTableCount = count($recordArray);
                    break;
                } else {
                    array_push($recordArray, $dataArray);
                }
                if (intval($result->count()) == 1) {
                    break;
                }
            }
            

            if ($scriptResultPrerequest !== NULL || $scriptResultPresort !== NULL || $scriptResult !== NULL) {
                // Avoid multiple executing FileMaker script
                if ($scriptResultPresort === NULL && $scriptResult === NULL) {
                    $scriptResult = $scriptResultPrerequest;
                } else if ($scriptResult === NULL) {
                    $scriptResult = $scriptResultPresort;
                }
                if (strpos($scriptResult, '/') !== false) {
                    $mainTableCount = substr($scriptResult, 0, strpos($scriptResult, '/'));
                    $mainTableTotalCount = substr($scriptResult, strpos($scriptResult, '/') + 1, strlen($scriptResult));
                    $this->mainTableCount = intval($mainTableCount);
                    $this->mainTableTotalCount = intval($mainTableTotalCount);
                } else {
                    $this->mainTableCount = intval($scriptResult);
                    $this->mainTableTotalCount = intval($scriptResult);
                }
            } else {
                if ($recordId === NULL) {
                    $result = $this->fmData->{$layout}->query($conditions, NULL, 1, 100000000, NULL, $script);
                }
                $this->mainTableCount = $result->count();
                $result = $this->fmData->{$layout}->query(NULL, NULL, 1, 100000000, NULL, $script);
                $this->mainTableTotalCount = $result->count();
            }
        }

        $token = $this->fmData->getSessionToken();
        if (!isset($_SESSION['X-FM-Data-Access-Token'])) {
            $_SESSION['X-FM-Data-Access-Token'] = $token;
        }

        return $recordArray;
    }

    private function createRecordset($resultData, $dataSourceName, $usePortal, $childRecordId, $childRecordIdValue)
    {
        $isFirstRecord = true;
        $returnArray = array();
        $tableName = $this->dbSettings->getEntityForRetrieve();
        
        foreach ($resultData as $oneRecord) {
            $oneRecordArray = array();

            $recId = $resultData->getRecordId();
            $oneRecordArray[$this->specHandler->getDefaultKey()] = $recId;

            $existsRelated = false;
            foreach ($resultData->getFieldNames() as $key => $field) {
                if ($isFirstRecord) {
                    $this->fieldInfo[] = $field;
                }
                // [WIP]
                //if (count($dataArray) == 1) {
                    if ($usePortal) {
                        if (strpos($field, '::') !== false) {
                            $existsRelated = true;
                        }
                        foreach ($dataArray as $portalKey => $portalValue) {
                            $oneRecordArray[$portalKey][$this->specHandler->getDefaultKey()] = $recId; // parent record id
                            $oneRecordArray[$portalKey][$field] = $this->formatter->formatterFromDB(
                                "{$tableName}{$this->dbSettings->getSeparator()}$field", $portalValue);
                        }
                        if ($existsRelated === false) {
                            $oneRecordArray = array();
                            $oneRecordArray[0][$this->specHandler->getDefaultKey()] = $recId; // parent record id
                        }
                    } else {
                        $oneRecordArray[$field] = $this->formatter->formatterFromDB(
                            "{$tableName}{$this->dbSettings->getSeparator()}$field", $oneRecord->$field);
                    }
                /*
                } else {
                    foreach ($dataArray as $portalKey => $portalValue) {
                        if (strpos($field, '::') !== false) {
                            $existsRelated = true;
                            $oneRecordArray[$portalKey][$this->specHandler->getDefaultKey()] = $recId; // parent record id
                            $oneRecordArray[$portalKey][$field] = $this->formatter->formatterFromDB(
                                "{$tableName}{$this->dbSettings->getSeparator()}$field", $portalValue);
                        } else {
                            $oneRecordArray[$field][] = $this->formatter->formatterFromDB(
                                "{$tableName}{$this->dbSettings->getSeparator()}$field", $portalValue);
                        }
                    }
                }
                */
            }
            if ($usePortal) {
                foreach ($oneRecordArray as $portalArrayField => $portalArray) {
                    if ($portalArrayField !== $this->specHandler->getDefaultKey()) {
                        $returnArray[] = $portalArray;
                    }
                }
                if ($existsRelated === false) {
                    $this->mainTableCount = 0;
                } else {
                    $this->mainTableCount = count($returnArray);
                }
            } else {
                if ($childRecordId == null) {
                    $returnArray[] = $oneRecordArray;
                } else {
                    foreach ($oneRecordArray as $portalArrayField => $portalArray) {
                        if (isset($oneRecordArray[$childRecordId])
                            && $childRecordIdValue == $oneRecordArray[$childRecordId]
                        ) {
                            $returnArray = array();
                            $returnArray[] = $oneRecordArray;
                            return $returnArray;
                        }
                        if (isset($oneRecordArray[$portalArrayField][$childRecordId])
                            && $childRecordIdValue == $oneRecordArray[$portalArrayField][$childRecordId]
                        ) {
                            $returnArray = array();
                            $returnArray[] = $oneRecordArray[$portalArrayField];
                            return $returnArray;
                        }
                    }
                }
            }
            $isFirstRecord = false;
        }
        
        return $returnArray;
    }

    public function countQueryResult()
    {
        return $this->mainTableCount;
    }

    public function getTotalCount()
    {
        return $this->mainTableTotalCount;
    }

    public function updateDB()
    {
        $this->fieldInfo = null;
        $dataSourceName = $this->dbSettings->getDataSourceName();
        $tableSourceName = $this->dbSettings->getEntityForUpdate();
        $context = $this->dbSettings->getDataSourceTargetArray();
        $data = array();

        $usePortal = false;
        if (isset($context['relation'])) {
            foreach ($context['relation'] as $relDef) {
                if (isset($relDef['portal']) && $relDef['portal']) {
                    $usePortal = true;
                    $context['paging'] = true;
                }
            }
        }

        if ($usePortal) {
            $layout = $this->dbSettings->getEntityForRetrieve();
            $this->setupFMDataAPIforDB($layout, 1);
        } else {
            $layout = $this->dbSettings->getEntityForUpdate();
            $this->setupFMDataAPIforDB($layout, 1);
        }
        $tableInfo = $this->dbSettings->getDataSourceTargetArray();
        $primaryKey = isset($tableInfo['key']) ? $tableInfo['key'] : $this->specHandler->getDefaultKey();

        if (isset($tableInfo['query'])) {
            foreach ($tableInfo['query'] as $condition) {
                if (!$this->dbSettings->getPrimaryKeyOnly() || $condition['field'] == $primaryKey) {
                    $condition = $this->normalizedCondition($condition);
                    if (!$this->specHandler->isPossibleOperator($condition['operator'])) {
                        throw new \Exception("Invalid Operator.");
                    }
                    $convertedValue = $this->formatter->formatterToDB(
                        "{$tableSourceName}{$this->dbSettings->getSeparator()}{$condition['field']}",
                        $condition['value']);
                    $data += array($condition['field'] => $convertedValue);
                    // [WIP] $this->fmData->AddDBParam($condition['field'], $convertedValue, $condition['operator']);
                }
            }
        }

        foreach ($this->dbSettings->getExtraCriteria() as $value) {
            if (!$this->dbSettings->getPrimaryKeyOnly() || $value['field'] == $primaryKey) {
                $value = $this->normalizedCondition($value);
                if (!$this->specHandler->isPossibleOperator($value['operator'])) {
                    throw new \Exception("Invalid Operator.: {$condition['operator']}");
                }
                $convertedValue = $this->formatter->formatterToDB(
                    "{$tableSourceName}{$this->dbSettings->getSeparator()}{$value['field']}", $value['value']);
                $data += array($value['field'] => $convertedValue);
            }
        }
        if (isset($tableInfo['authentication'])
            && (isset($tableInfo['authentication']['all'])
                || isset($tableInfo['authentication']['update']))
        ) {
            $authFailure = FALSE;
            $authInfoField = $this->authHandler->getFieldForAuthorization("update");
            $authInfoTarget = $this->authHandler->getTargetForAuthorization("update");
            if ($authInfoTarget == 'field-user') {
                if (strlen($this->dbSettings->getCurrentUser()) == 0) {
                    $authFailure = true;
                } else {
                    $signedUser = $this->authHandler->authSupportUnifyUsernameAndEmail($this->dbSettings->getCurrentUser());
                    if ($cwpkit->_checkDuplicatedFXCondition($fxUtility->CreateCurrentSearch(), $authInfoField, $signedUser) === TRUE) {
                        $this->fmData->AddDBParam($authInfoField, $signedUser, "eq");
                    }
                }
            } else if ($authInfoTarget == 'field-group') {
                $belongGroups = $this->authHandler->authSupportGetGroupsOfUser($this->dbSettings->getCurrentUser());
                if (strlen($this->dbSettings->getCurrentUser()) == 0 || count($belongGroups) == 0) {
                    $authFailure = true;
                } else {
                    if ($cwpkit->_checkDuplicatedFXCondition($fxUtility->CreateCurrentSearch(), $authInfoField, $belongGroups[0]) === TRUE) {
                        $this->fmData->AddDBParam($authInfoField, $belongGroups[0], "eq");
                    }
                }
            } else {
                if ($this->dbSettings->isDBNative()) {
                } else {
                    $authorizedUsers = $this->authHandler->getAuthorizedUsers("update");
                    $authorizedGroups = $this->authHandler->getAuthorizedGroups("update");
                    $belongGroups = $this->authHandler->authSupportGetGroupsOfUser($this->dbSettings->getCurrentUser());
                    if (!in_array($this->dbSettings->getCurrentUser(), $authorizedUsers)
                        && array_intersect($belongGroups, $authorizedGroups)
                    ) {
                        $authFailure = true;
                    }
                }
            }
            if ($authFailure) {
                return false;
            }
        }

        $pKey = filter_input(INPUT_POST, 'condition0value');
        if ($pKey === NULL || $pKey === FALSE) {
            $condition = array($data);
        } else {
            $condition = array(array($primaryKey => filter_input(INPUT_POST, 'condition0value')));
        }
        $result = NULL;
        $portal = array();
        if (count($condition) === 1 && isset($condition[0]) && isset($condition[0]['recordId'])) {
            $recordId = str_replace('=', '', $condition[0]['recordId']);
            if (is_numeric($recordId)) {
                $result = $this->fmData->{$layout}->getRecord($recordId);
            }
        } else {
            $result = $this->fmData->{$layout}->query($condition, NULL, 1, 1);
            $portalNames = $result->getPortalNames();
            if (count($portalNames) >= 1) {
                foreach ($portalNames as $key => $portalName) {
                    $portal = array_merge($portal, array($key => $portalName));
                }
                $result = $this->fmData->{$layout}->query($condition, NULL, 1, 1, $portal);
            }
        }

        if (get_class($result) !== 'INTERMediator\\FileMakerServer\\RESTAPI\\Supporting\\FileMakerRelation') {
            if ($this->dbSettings->isDBNative()) {
                $this->dbSettings->setRequireAuthentication(true);
            } else {
                $this->logger->setErrorMessage(
                    $this->stringWithoutCredential(get_class($result) . ': ' . $result->getDebugInfo()));
            }
            return false;
        }

        // [WIP] $this->logger->setDebugMessage($this->stringWithoutCredential($result['URL']));
//        $this->logger->setDebugMessage($this->stringWithoutCredential(var_export($this->dbSettings->getFieldsRequired(),true)));

        /* [WIP]
        if ($result['errorCode'] > 0) {
            $this->logger->setErrorMessage($this->stringWithoutCredential(
                "FX reports error at find action: code={$result['errorCode']}, url={$result['URL']}<hr>"));
            return false;
        }
        */
        if ($result->count() === 1) {
            $this->notifyHandler->setQueriedPrimaryKeys(array());
            $keyField = isset($context['key']) ? $context['key'] : $this->specHandler->getDefaultKey();
            foreach ($result as $record) {
                $recId = $record->getRecordId();
                if ($keyField == $this->specHandler->getDefaultKey()) {
                    $this->notifyHandler->addQueriedPrimaryKeys($recId);
                } else {
                    $this->notifyHandler->addQueriedPrimaryKeys($record->{$keyField});
                }
                /*
                if ($usePortal) {
                    $this->setupFMDataAPIforDB($this->dbSettings->getEntityForRetrieve(), 1);
                } else {
                    $this->setupFMDataAPIforDB($this->dbSettings->getEntityForUpdate(), 1);
                }
                */
                //$this->fmData->SetRecordID($recId);
                $counter = 0;
                $fieldValues = $this->dbSettings->getValue();
                foreach ($this->dbSettings->getFieldsRequired() as $field) {
                    if (strpos($field, '.') !== false) {
                        // remove dot + recid number if contains recid (example: "TO::FIELD.0" -> "TO::FIELD")
                        $dotPos = strpos($field, '.');
                        $originalfield = substr($field, 0, $dotPos);
                    } else {
                        $originalfield = $field;
                    }
                    $value = $fieldValues[$counter];
                    $counter++;
                    $convVal = $this->stringReturnOnly((is_array($value)) ? implode("\n", $value) : $value);
                    $convVal = $this->formatter->formatterToDB(
                        $this->getFieldForFormatter($tableSourceName, $originalfield), $convVal);
                    $data += array($field => $convVal);
                }
                if ($counter < 1) {
                    $this->logger->setErrorMessage('No data to update.');
                    return false;
                }
                if (isset($tableInfo['global'])) {
                    foreach ($tableInfo['global'] as $condition) {
                        if ($condition['db-operation'] == 'update') {
                            $this->fmData->{$layout}->setGlobalField(
                                array($condition['field'] => $condition['value'])
                            );
                        }
                    }
                }
                $script = NULL;
                if (isset($context['script'])) {
                    foreach ($context['script'] as $condition) {
                        if ($condition['db-operation'] == 'update') {
                            $script = $this->executeScripts($context['script']);
                        }
                    }
                }

                $this->notifyHandler->setQueriedEntity($this->fmData->layout);
                $this->fmData->{$layout}->keepAuth = true;

                $fieldName = filter_input(INPUT_POST, '_im_field');
                $useContainer = FALSE;
                if (isset($context['file-upload'])) {
                    foreach ($context['file-upload'] as $item) {
                        if (isset($item['field']) &&
                            $item['field'] === $fieldName &&
                            isset($item['container']) &&
                            (boolean)$item['container'] === TRUE) {
                            $useContainer = TRUE;
                        }
                    }
                }

                if ($useContainer === TRUE) {
                    $data[$fieldName] = str_replace(array("\r\n", "\r", "\n"), "\r", $data[$fieldName]);
                    $meta = explode("\r", $data[$fieldName]);
                    $fileName = $meta[0];
                    $contaierData = $meta[1];

                    $temp = tmpfile();
                    if ($temp !== FALSE) {
                        $tempMeta = stream_get_meta_data($temp);
                        $handle = fopen($temp, 'w');
                        fwrite($temp, base64_decode($contaierData));
                        // INTER-Mediator doesn't support repeating fields now.
                        $this->fmData->{$layout}->uploadFile($tempMeta['uri'], $recId, $fieldName, NULL, $fileName);
                        fclose($temp);
                    } else {
                        // [WIP]
                    }
                } else {
                    $originalfield = filter_input(INPUT_POST, 'field_0');
                    $value = filter_input(INPUT_POST, 'value_0');
                    $convVal = $this->formatter->formatterToDB(
                        $this->getFieldForFormatter($tableSourceName, $originalfield), $value);
                    if ($originalfield !== FALSE && $originalfield !== NULL) {
                        $data += array($originalfield => $convVal);
                    }
                    $this->fmData->{$layout}->update($recId, $data, -1, NULL, $script);
                }
                $result = $this->fmData->{$layout}->getRecord($recId);
                /* [WIP]
                if (!is_array($result)) {
                    $this->logger->setErrorMessage($this->stringWithoutCredential(
                        get_class($result) . ': ' . $result->getDebugInfo()));
                    return false;
                }
                */
                /* [WIP]
                if ($result['errorCode'] > 0) {
                    $this->logger->setErrorMessage($this->stringWithoutCredential(
                        "FX reports error at edit action: table={$this->dbSettings->getEntityForUpdate()}, "
                        . "code={$result['errorCode']}, url={$result['URL']}<hr>"));
                    return false;
                }
                */
                // [WIP]
                $this->updatedRecord = $this->createRecordset($result, $dataSourceName, null, null, null);
                // [WIP] $this->logger->setDebugMessage($this->stringWithoutCredential($result['URL']));
                break;
            }
        } else {

        }
        return true;
    }

    public function createInDB($bypassAuth)
    {
        $this->fieldInfo = null;

        $context = $this->dbSettings->getDataSourceTargetArray();
        $dataSourceName = $this->dbSettings->getDataSourceName();

        $usePortal = false;
        if (isset($context['relation'])) {
            foreach ($context['relation'] as $relDef) {
                if (isset($relDef['portal']) && $relDef['portal']) {
                    $usePortal = true;
                    $context['paging'] = true;
                }
            }
        }

        $keyFieldName = isset($context['key']) ? $context['key'] : $this->specHandler->getDefaultKey();

        $recordData = array();

        $this->setupFMDataAPIforDB($this->dbSettings->getEntityForUpdate(), 1);
        $requiredFields = $this->dbSettings->getFieldsRequired();
        $countFields = count($requiredFields);
        $fieldValues = $this->dbSettings->getValue();
        for ($i = 0; $i < $countFields; $i++) {
            $field = $requiredFields[$i];
            $value = $fieldValues[$i];
            if ($field != $keyFieldName) {
                $recordData += array(
                    $field =>
                    $this->formatter->formatterToDB(
                        "{$this->dbSettings->getEntityForUpdate()}{$this->dbSettings->getSeparator()}{$field}",
                        $this->unifyCRLF((is_array($value)) ? implode("\r", $value) : $value))
                );
            }
        }
        if (isset($context['default-values'])) {
            foreach ($context['default-values'] as $itemDef) {
                $field = $itemDef['field'];
                $value = $itemDef['value'];
                if ($field != $keyFieldName) {
                    $filedInForm = "{$this->dbSettings->getEntityForUpdate()}{$this->dbSettings->getSeparator()}{$field}";
                    $convVal = $this->unifyCRLF((is_array($value)) ? implode("\r", $value) : $value);
                    $recordData += array($field => $this->formatter->formatterToDB($filedInForm, $convVal));
                }
            }
        }
        if (!$bypassAuth && isset($context['authentication'])
            && (isset($context['authentication']['all'])
                || isset($context['authentication']['new'])
                || isset($context['authentication']['create']))
        ) {
            $authInfoField = $this->authHandler->getFieldForAuthorization("create");
            $authInfoTarget = $this->authHandler->getTargetForAuthorization("create");
            if ($authInfoTarget == 'field-user') {
                $signedUser = $this->authHandler->authSupportUnifyUsernameAndEmail($this->dbSettings->getCurrentUser());
                $recordData += array(
                    $authInfoField =>
                    strlen($this->dbSettings->getCurrentUser()) == 0 ? IMUtil::randomString(10) : $signedUser
                );
            } else if ($authInfoTarget == 'field-group') {
                $belongGroups = $this->authHandler->authSupportGetGroupsOfUser($this->dbSettings->getCurrentUser());
                $recordData += array(
                    $authInfoField =>
                    strlen($belongGroups[0]) == 0 ? IMUtil::randomString(10) : $belongGroups[0]
                );
            } else {
                if ($this->dbSettings->isDBNative()) {
                } else {
                    $authorizedUsers = $this->authHandler->getAuthorizedUsers("create");
                    $authorizedGroups = $this->authHandler->getAuthorizedGroups("create");
                    $belongGroups = $this->authHandler->authSupportGetGroupsOfUser($this->dbSettings->getCurrentUser());
                    if (!in_array($this->dbSettings->getCurrentUser(), $authorizedUsers)
                        && array_intersect($belongGroups, $authorizedGroups)
                    ) {
                        $authFailure = true;
                    }
                }
            }
        }
        if (isset($context['global'])) {
            foreach ($context['global'] as $condition) {
                if ($condition['db-operation'] == 'new' || $condition['db-operation'] == 'create') {
                    $this->fmData->{$layout}->setGlobalField(
                        array($condition['field'] => $condition['value'])
                    );
                }
            }
        }
        $script = NULL;
        if (isset($context['script'])) {
            foreach ($context['script'] as $condition) {
                if ($condition['db-operation'] == 'new' || $condition['db-operation'] == 'create') {
                    $script = $this->executeScripts($context['script']);
                }
            }
        }

        $layout = $this->dbSettings->getEntityForUpdate();
        $recId = $this->fmData->{$layout}->create($recordData, NULL, $script);
        $result = $this->fmData->{$layout}->getRecord($recId);
        if (get_class($result) !== 'INTERMediator\\FileMakerServer\\RESTAPI\\Supporting\\FileMakerRelation') {
            if ($this->dbSettings->isDBNative()) {
                $this->dbSettings->setRequireAuthentication(true);
            } else {
                // [WIP] $this->errorMessage[] = get_class($result) . ': ' . $result->getDebugInfo();
            }
            return false;
        }

        // [WIP] $this->logger->setDebugMessage($this->stringWithoutCredential($result['URL']));
        if ($this->fmData->errorCode() > 0 && $this->fmData->errorCode() != 401) {
            $this->logger->setErrorMessage($this->stringWithoutCredential(
                "FileMaker Data API reports error at create action: code={$this->fmData->errorCode()}<hr>"));
            return false;
        }

        $this->notifyHandler->setQueriedPrimaryKeys(array($recId));
        $this->notifyHandler->setQueriedEntity($this->fmData->layout);

        // [WIP]
        //$this->updatedRecord = $this->createRecordset($result['data'], $dataSourceName, null, null, null);
        $this->updatedRecord = $this->createRecordset($result, $dataSourceName, null, null, null);

        return $recId;
    }

    public function deleteFromDB()
    {
        $this->fieldInfo = null;

        $context = $this->dbSettings->getDataSourceTargetArray();
        $condition = array();

        $usePortal = false;
        if (isset($context['relation'])) {
            foreach ($context['relation'] as $relDef) {
                if (isset($relDef['portal']) && $relDef['portal']) {
                    $usePortal = true;
                    $context['paging'] = true;
                }
            }
        }

        if ($usePortal) {
            $layout = $this->dbSettings->getEntityForRetrieve();
            $this->setupFMDataAPIforDB($layout, 10000000);
        } else {
            $layout = $this->dbSettings->getEntityForUpdate();
            $this->setupFMDataAPIforDB($layout, 10000000);
        }

        foreach ($this->dbSettings->getExtraCriteria() as $value) {
            $value = $this->normalizedCondition($value);
            if (!$this->specHandler->isPossibleOperator($value['operator'])) {
                throw new \Exception("Invalid Operator.");
            }
            $condition += array($value['field'] => $value['value']);
            // $this->fmData->AddDBParam($value['field'], $value['value'], $value['operator']);  [WIP]
        }
        if (isset($context['authentication'])
            && (isset($context['authentication']['all'])
                || isset($context['authentication']['delete']))
        ) {
            $authFailure = FALSE;
            $authInfoField = $this->authHandler->getFieldForAuthorization("delete");
            $authInfoTarget = $this->authHandler->getTargetForAuthorization("delete");
            if ($authInfoTarget == 'field-user') {
                if (strlen($this->dbSettings->getCurrentUser()) == 0) {
                    $authFailure = true;
                } else {
                    $signedUser = $this->authHandler->authSupportUnifyUsernameAndEmail($this->dbSettings->getCurrentUser());
                    $this->fmData->AddDBParam($authInfoField, $signedUser, "eq");
                    $hasFindParams = true;
                }
            } else if ($authInfoTarget == 'field-group') {
                $belongGroups = $this->authHandler->authSupportGetGroupsOfUser($this->dbSettings->getCurrentUser());
                $groupCriteria = array();
                if (strlen($this->dbSettings->getCurrentUser()) == 0 || count($groupCriteria) == 0) {
                    $authFailure = true;
                } else {
                    $this->fmData->AddDBParam($authInfoField, $belongGroups[0], "eq");
                    $hasFindParams = true;
                }
            } else {
                if ($this->dbSettings->isDBNative()) {
                } else {
                    $authorizedUsers = $this->authHandler->getAuthorizedUsers("delete");
                    $authorizedGroups = $this->authHandler->getAuthorizedGroups("delete");
                    $belongGroups = $this->authHandler->authSupportGetGroupsOfUser($this->dbSettings->getCurrentUser());
                    if (!in_array($this->dbSettings->getCurrentUser(), $authorizedUsers)
                        && array_intersect($belongGroups, $authorizedGroups)
                    ) {
                        $authFailure = true;
                    }
                }
            }
            if ($authFailure) {
                return false;
            }
        }

        if (isset($condition['recordId']) && is_numeric($condition['recordId'])) {
            $result = $this->fmData->{$layout}->getRecord($condition['recordId']);
        } else {
            $result = $this->fmData->{$layout}->query(array($condition), NULL, 1, 1);
        }
        if (get_class($result) !== 'INTERMediator\\FileMakerServer\\RESTAPI\\Supporting\\FileMakerRelation') {
            if ($this->dbSettings->isDBNative()) {
                $this->dbSettings->setRequireAuthentication(true);
            } else {
                $this->errorMessage[] = get_class($result) . ': ' . $result->getDebugInfo();
            }
            return false;
        }
        // [WIP] $this->logger->setDebugMessage($this->stringWithoutCredential($result['URL']));
        //$this->logger->setDebugMessage($this->stringWithoutCredential(var_export($result['data'],true)));
        if ($this->fmData->errorCode() > 0) {
            $this->errorMessage[] = "FX reports error at find action: code={$result['errorCode']}, url={$result['URL']}<hr>";
            return false;
        }
        if ($result->count() > 0) {
            $keyField = isset($context['key']) ? $context['key'] : $this->specHandler->getDefaultKey();
            foreach ($result as $record) {
                $recId = $record->getRecordId();
                if ($keyField == $this->specHandler->getDefaultKey()) {
                    $this->notifyHandler->addQueriedPrimaryKeys($recId);
                } else {
                    $this->notifyHandler->addQueriedPrimaryKeys($record->{$keyField});
                }
                $this->setupFMDataAPIforDB($this->dbSettings->getEntityForUpdate(), 1);
                if (isset($context['global'])) {
                    foreach ($context['global'] as $condition) {
                        if ($condition['db-operation'] == 'delete') {
                            $this->fmData->{$layout}->setGlobalField(
                                array($condition['field'] => $condition['value'])
                            );
                        }
                    }
                }
                $script = NULL;
                if (isset($context['script'])) {
                    foreach ($context['script'] as $condition) {
                        if ($condition['db-operation'] == 'delete') {
                            $script = $this->executeScripts($context['script']);
                        }
                    }
                }

                $this->notifyHandler->setQueriedEntity($this->fmData->layout);

                try {
                    $result = $this->fmData->{$layout}->delete($recId, $script);
                } catch (\Exception $e) {
                    if ($this->dbSettings->isDBNative()) {
                        $this->dbSettings->setRequireAuthentication(true);
                    } else {
                        /* [WIP]
                        $this->logger->setErrorMessage($this->stringWithoutCredential(
                            get_class($result) . ': ' . $result->getDebugInfo()));
                        */
                    }
                    return false;
                }
                if ($this->fmData->errorCode() > 0) {
                    /* [WIP]
                    $this->logger->setErrorMessage($this->stringWithoutCredential(
                        "FileMaker Data API reports error at delete action: code={$result['errorCode']}, url={$result['URL']}<hr>"));
                    */
                    return false;
                }
                $this->logger->setDebugMessage($this->stringWithoutCredential($result['URL']));
            }
        }
        return true;
    }

    public function copyInDB()
    {
        $this->errorMessage[] = "Copy operation is not implemented so far.";
    }

    private function getFieldForFormatter($entity, $field)
    {
        if (strpos($field, "::") === false) {
            return "{$entity}{$this->dbSettings->getSeparator()}{$field}";
        }
        $fieldComp = explode("::", $field);
        $ds = $this->dbSettings->getDataSource();
        foreach ($ds as $contextDef) {
            if ($contextDef["name"] == $fieldComp[0] ||
                (isset($contextDef["table"]) && $contextDef["table"] == $fieldComp[0])
            ) {
                if (isset($contextDef["relation"]) &&
                    isset($contextDef["relation"][0]) &&
                    isset($contextDef["relation"][0]["portal"]) &&
                    $contextDef["relation"][0]["portal"] = true
                ) {
                    return "{$fieldComp[0]}{$this->dbSettings->getSeparator()}{$field}";
                }
            }
        }
        return "{$entity}{$this->dbSettings->getSeparator()}{$field}";
    }

    public function normalizedCondition($condition)
    {
        if (!isset($condition['field'])) {
            $condition['field'] = '';
        }
        if (!isset($condition['value'])) {
            $condition['value'] = '';
        }

        if (($condition['field'] === 'recordId' && $condition['operator'] === 'undefined') ||
            ($condition['operator'] === '=')
        ) {
            return array(
                'field' => $condition['field'],
                'operator' => 'eq',
                'value' => "{$condition['value']}",
            );
        } else if ($condition['operator'] === '!=') {
            return array(
                'field' => $condition['field'],
                'operator' => 'neq',
                'value' => "{$condition['value']}",
            );
        } else if ($condition['operator'] === '<') {
            return array(
                'field' => $condition['field'],
                'operator' => 'lt',
                'value' => "{$condition['value']}",
            );
        } else if ($condition['operator'] === '<=') {
            return array(
                'field' => $condition['field'],
                'operator' => 'lte',
                'value' => "{$condition['value']}",
            );
        } else if ($condition['operator'] === '>') {
            return array(
                'field' => $condition['field'],
                'operator' => 'gt',
                'value' => "{$condition['value']}",
            );
        } else if ($condition['operator'] === '>=') {
            return array(
                'field' => $condition['field'],
                'operator' => 'gte',
                'value' => "{$condition['value']}",
            );
        } else if ($condition['operator'] === 'match*') {
            return array(
                'field' => $condition['field'],
                'operator' => 'bw',
                'value' => "{$condition['value']}",
            );
        } else if ($condition['operator'] === '*match') {
            return array(
                'field' => $condition['field'],
                'operator' => 'ew',
                'value' => "{$condition['value']}",
            );
        } else if ($condition['operator'] === '*match*') {
            return array(
                'field' => $condition['field'],
                'operator' => 'cn',
                'value' => "{$condition['value']}",
            );
        } else {
            return $condition;
        }
    }

    public function queryForTest($table, $conditions = null)
    {
        if ($table == null) {
            $this->errorMessageStore("The table doesn't specified.");
            return false;
        }
        $this->setupFMDataAPIforAuth($table, 'all');
        $recordSet = array();
        try {
            $result = $this->fmDataAuth->{$table}->query(array($conditions), NULL, 1, 100000000);
            foreach ($result as $record) {
                $oneRecord = array();
                foreach ($result->getFieldNames() as $key => $fieldName) {
                    $oneRecord[$fieldName] = $record->{$fieldName};
                }
                $recordSet[] = $oneRecord;
            }
        } catch (\Exception $e) {
        }

        return $recordSet;
    }

    protected function _adjustSortDirection($direction)
    {
        if (strtoupper($direction) == 'ASC') {
            $direction = 'ascend';
        } else if (strtoupper($direction) == 'DESC') {
            $direction = 'descend';
        }

        return $direction;
    }


    public function deleteForTest($table, $conditions = null)
    {
        // TODO: Implement deleteForTest() method.
    }
}
