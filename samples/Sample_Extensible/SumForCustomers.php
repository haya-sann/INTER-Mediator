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
use \INTERMediator\DB\Extending_Interface_AfterRead;

class SumForCustomers implements Extending_Interface_AfterRead
{
    public function doAfterReadFromDB($result)
    {
        $sum = array();
        foreach ($result as $record) {
            if (!isset($sum[$record["customer"]])) {
                $sum[$record["customer"]] = $record["total"];
            } else {
                $sum[$record["customer"]] += $record["total"];
            }
        }
        arsort($sum);
        $result = array();
        $counter = 10;
        foreach ($sum as $customer => $totalprice) {
            $result[] = array(
                "customername" => $customer,
                "totalprice" => number_format($totalprice)
            );
            $counter--;
            if ($counter <= 0) {
                break;
            }
        }
        return $result;
    }
}
