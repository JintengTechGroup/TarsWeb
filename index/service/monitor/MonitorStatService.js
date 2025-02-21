/**
 * Tencent is pleased to support the open source community by making Tars available.
 *
 * Copyright (C) 2016THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the BSD 3-Clause License (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * https://opensource.org/licenses/BSD-3-Clause
 *
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
const uuid = require("uuid");
const logger = require('../../../logger');
const WebConf = require('../../../config/webConf');

const { monitorQueryStruct } = require('../../../rpc/struct');

let statQueryPrx1;
let statQueryPrx2;

if (WebConf.isEnableK8s()) {
	statQueryPrx2 = require('../../../rpc/k8s').statQueryPrx;
} else {
	statQueryPrx1 = require('../../../rpc').statQueryPrx;
}

function getStatQueryPrx(k8s) {
	if (k8s == "true") {
		return statQueryPrx2;
	} else {
		return statQueryPrx1;
	}	
}

const MonitorStatService = {};

MonitorStatService.getData = async (params) => {
	let theData = new Map(), preData = new Map()
	theData = await callRpc(params, true);
	preData = await callRpc(params, false);
	return merge(params, theData, preData);
};


async function callRpc(params, the) {
	let date = the ? params.thedate : params.predate,
		conditions = [],
		startshowtime = params.startshowtime || '0000',
		endshowtime = params.endshowtime || '2360';

	let req = new monitorQueryStruct.MonitorQueryReq();
	req.uid = uuid.v1()
	req.dataid = "tars_stat"
	req.indexs.readFromObject(['succ_count', 'timeout_count', 'exce_count', 'total_time'])
	req.date = date;
	req.tflag1 = startshowtime;
	req.tflag2 = endshowtime;

	// conditions.push({ field: "f_date", op: monitorQueryStruct.OP.EQ, val:Mysql.escape(date) })
	// conditions.push({ field: "f_tflag", op: monitorQueryStruct.OP.GTE, val:Mysql.escape(startshowtime) })
	// conditions.push({ field: "f_tflag", op: monitorQueryStruct.OP.LTE, val:Mysql.escape(endshowtime) })

	if (params.master_name) {
		conditions.push({ field: "master_name", op: monitorQueryStruct.OP.LIKE, val:params.master_name })
	}
	if (params.slave_name) {
		conditions.push({ field: "slave_name", op: monitorQueryStruct.OP.LIKE, val:params.slave_name })
	}
	if (params.interface_name) {
		conditions.push({ field: "interface_name", op: monitorQueryStruct.OP.LIKE, val:params.interface_name})
	}
	if (params.master_ip) {
		conditions.push({ field: "master_ip", op: monitorQueryStruct.OP.LIKE, val:params.master_ip })
	}
	if (params.slave_ip) {
		conditions.push({ field: "slave_ip", op: monitorQueryStruct.OP.LIKE, val:params.slave_ip })
	}
	req.conditions.readFromObject(conditions)
	req.groupby.readFromObject(params.group_by ? ['f_date', params.group_by] : ['f_tflag'])
	let data = await getStatQueryPrx(params.k8s).query(req)

	let rsp = data.rsp

	console.log(rsp);
	let map = new Map()

	if (data.__return != 0 || rsp.ret != 0) {
		return map;
	}
		// throw new Error(`query stat info code:${data.__return}  ret: ${rsp.ret}, msg: ${rsp.msg}`)

	for(let key in rsp.result){
		map.set(key, rsp.result[key])
	}
	return map
}

function merge(params, theData, preData) {
	let result = [];
	let set = mergeKey(params, theData, preData);
	for (let item of set) {
		let thevalue = translate(theData.get(item)),
			prevalue = translate(preData.get(item)),
			thevalueOutput = formatValue(thevalue),
			prevalueOutput = formatValue(prevalue),
			totalCountWave = '';
		if (thevalue[0] < 0 || prevalue[0] < 0) {
			totalCountWave = '--';
		} else {
			if (prevalue[0] == 0) {
				if (thevalue[0] == 0) {
					totalCountWave = '0%';
				} else {
					totalCountWave = '+∞%';
				}
			} else {
				let wave = (thevalue[0] - prevalue[0]) / prevalue[0];
				totalCountWave = (wave * 100).toFixed(2) + '%';
			}
		}

		let tmpObj = {
			interface_name: params.interface_name || '%',
			master_ip: params.master_ip || '%',
			master_name: params.master_name || '%',
			slave_name: params.slave_name || '%',
			slave_ip: params.slave_ip || '%',

			the_total_count: thevalueOutput[0],
			the_avg_time: thevalueOutput[1],
			the_fail_rate: thevalueOutput[2],
			the_timeout_rate: thevalueOutput[3],

			pre_total_count: prevalueOutput[0],
			pre_avg_time: prevalueOutput[1],
			pre_fail_rate: prevalueOutput[2],
			pre_timeout_rate: prevalueOutput[3],

			total_count_wave: totalCountWave
		};

		let groupby = params.group_by ? ['f_date', params.group_by] : ['f_tflag'];
		for (let i = 0; i < groupby.length; i++) {
			let callGroup = groupby[i],
				key = item.split(','),
				callGroupValue = key[i];

			switch (callGroup) {
				case 'f_date' :
					tmpObj.show_date = callGroupValue;
					break;
				case 'f_tflag' :
					tmpObj.show_time = callGroupValue;
					break;
				case 'master_name' :
					tmpObj.master_name = callGroupValue;
					break;
				case 'slave_name' :
					tmpObj.slave_name = callGroupValue;
					break;
				case 'interface_name' :
					tmpObj.interface_name = callGroupValue;
					break;
				case 'master_ip' :
					tmpObj.master_ip = callGroupValue;
					break;
				case 'slave_ip' :
					tmpObj.slave_ip = callGroupValue;
					break;
			}
		}

		result.push(tmpObj);
	}
	return result;
}

function mergeKey(params, theData, preData) {
	let set = new Set();
	for (let key of theData.keys()) {
		set.add(key);
	}
	for (let key of preData.keys()) {
		key = key.split(',');
		// if (key.length > 1) {
		if (key.length > 1 && (!params.group_by_first || params.group_by_first == 'f_date')) {
			key[0] = params.thedate;
		}
		set.add(key.join(','));
	}
	return set;
}

function translate(data) {
	if (!data) {
		return [0, 0, 0, 0];
	}
	let ret = [];
	let total = parseInt(data[0]) + parseInt(data[1]) + parseInt(data[2]);
	ret[0] = total;
	ret[1] = total == 0 ? 0 : data[3] / ret[0];
	ret[2] = total == 0 ? 0 : data[2] / ret[0];
	ret[3] = total == 0 ? 0 : data[1] / ret[0];
	return ret;
}

function formatValue(data) {
	let ret = [];
	ret[0] = data[0] < 0 ? '--' : data[0].toFixed(0);
	ret[1] = data[1] < 0 ? '--' : data[1].toFixed(2);
	ret[2] = data[2] < 0 ? '--' : (data[2] * 100).toFixed(2) + '%';
	ret[3] = data[3] < 0 ? '--' : (data[3] * 100).toFixed(2) + '%';
	return ret;
}


module.exports = MonitorStatService;