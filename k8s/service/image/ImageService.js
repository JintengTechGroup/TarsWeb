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

const CommonService = require('../common/CommonService');
const md5 = require('md5');

const ImageService = {};

const imageSelect = async (label) => {

	let labelSelector = `${CommonService.TImageTypeLabel}=${label}`;
	let allItems = (await CommonService.listObject("timages", labelSelector)).body;

	let result = {};

	// Data填充
	result.Data = [];

	if (allItems) {

		allItems = allItems.items;

		allItems.forEach(item => {

			let elem = {};

			item.releases = item.releases || [];
			elem["Name"] = item.metadata.name

			elem["SupportedType"] = item.supportedType
			elem["Count"] = item.releases.length;
			elem["Mark"] = item.mark
			elem["CreateTime"] = item.metadata.creationTimestamp;

			result.Data.push(elem);
		})
	}

	return {
		ret: 200,
		msg: 'succ',
		data: result
	};
}


ImageService.nodeImageSelect = async () => {
	return imageSelect('node');
}

ImageService.imageSelect = async () => {
	return imageSelect('base');
}

ImageService.serverImageGetAndCreate = async (ServerApp, ServerName) => {
	
	let name = CommonService.getTServerName(ServerApp + '-' + ServerName);

	let result = await CommonService.getObject("timages", name);

	if (!result) {
		
		let tImage = {
			apiVersion: CommonService.GROUP + '/' + CommonService.VERSION,
			kind: 'TImage',
			metadata: {
				namespace: CommonService.NAMESPACE,
				name: name,
				labels: {}
			},
			imageType: 'server',
			releases: []
		}

		tImage.metadata.labels[`${CommonService.TImageTypeLabel}`] = 'server';
		tImage.metadata.labels[`${CommonService.TServerAppLabel}`] = ServerApp;
		tImage.metadata.labels[`${CommonService.TServerNameLabel}`] = ServerName;

		// console.log(tImage.metadata.labels);

		result = await CommonService.createObject("timages", tImage);
	}

	return { ret: 200, msg: 'succ', data: result.body };
}

ImageService.imageCreate = async (metadata) => {

	let tImage = {
		apiVersion: CommonService.GROUP + '/' + CommonService.VERSION,
		kind: 'TImage',
		metadata: {
			namespace: CommonService.NAMESPACE,
			name: md5(JSON.stringify(metadata) + "-" + (new Date()), 'asString'),
			labels: {},
		},
		imageType: 'base',
		supportedType: metadata.SupportedType,
		mark: metadata.Mark,
		releases: []
	}

	tImage.metadata.labels[`${CommonService.TImageTypeLabel}`] = 'base';

	let result = await CommonService.createObject("timages", tImage);

	return {
		ret: 200,
		msg: 'succ',
		data: result.body
	};
}

ImageService.imageUpdate = async (metadata) => {

	let tImage = (await CommonService.getObject("timages", metadata.Name));
	if (!tImage) {
		return {
			ret: 500,
			msg: "image not exists"
		};
	}

	tImage = tImage.body;

	tImage.supportedType = metadata.SupportedType;
	tImage.mark = metadata.Mark;

	let result = CommonService.replaceObject("timages", metadata.Name, tImage);

	return {
		ret: 200,
		msg: 'succ',
		data: result.body
	};

}

ImageService.imageDelete = async (metadata) => {
	await CommonService.deleteObject("timages", metadata.Name);

	return {
		ret: 200,
		msg: 'succ'
	};
}

ImageService.baseImageSelect = async (metadata) => {

	let labelSelector = `${CommonService.TImageTypeLabel}=base,${CommonService.TSupportedLabel}${metadata.ServerType}=`;
	let allItems = (await CommonService.listObject("timages", labelSelector)).body;

	let result = {};

	// Data填充
	result.Data = [];

	if (allItems) {

		allItems = allItems.items;

		allItems.forEach(item => {

			let elem = {};

			item.releases = item.releases || [];
			elem["Name"] = item.metadata.name

			elem["SupportedType"] = item.supportedType
			elem["Count"] = item.releases.length;
			elem["Mark"] = item.mark
			elem["CreateTime"] = item.metadata.creationTimestamp;

			elem["Release"] = [];

			item.releases.forEach(release => {

				let r = {};
				r["Id"] = release.id;
				r["CreatePerson"] = release.createPerson;
				r["CreateTime"] = release.createTime;
				r["Secret"] = release.secret;
				r["Mark"] = release.mark;
				r["Image"] = release.image;

				elem["Release"].push(r);
			})

			result.Data.push(elem);
		})
	}

	return { ret: 200, msg: 'succ', data: result };

}

ImageService.imageReleaseSelect = async (metadata) => {

	let tImage = (await CommonService.getObject("timages", metadata.Name));
	if (!tImage) {
		return {
			ret: 500,
			msg: "image not exists"
		};
	}

	tImage = tImage.body;

	let result = {};

	// Data填充
	result.Data = [];

	tImage.releases.forEach(release => {

		let r = {};
		r["Id"] = release.id;
		r["CreatePerson"] = release.createPerson;
		r["CreateTime"] = release.createTime;
		r["Secret"] = release.secret;
		r["Mark"] = release.mark;
		r["Image"] = release.image;

		// console.log(release);

		result.Data.push(r);
	})

	return {
		ret: 200,
		msg: 'succ',
		data: result
	};
}


ImageService.imageReleaseDelete = async (metadata) => {

	let tImage = (await CommonService.getObject("timages", metadata.Name));
	if (!tImage) {
		return {
			ret: 500,
			msg: "image not exists"
		};
	}

	tImage = tImage.body;

	tImage.releases = tImage.releases.filter(release => {
		return release.id != metadata.Id;
	});

	await CommonService.replaceObject("timages", metadata.Name, tImage);

	return {
		ret: 200,
		msg: 'succ'
	};
}

ImageService.imageReleaseCreate = async (metadata) => {

	let imageName = CommonService.getTServerName(metadata.Name);
	let tImage = (await CommonService.getObject("timages", imageName));
	if (!tImage) {
		return {
			ret: 500,
			msg: "image not exists"
		};
	}

	tImage = tImage.body;

	tImage.releases.push({
		id: 'v-' + (new Date()).getTime(),
		image: metadata.Image,
		secret: metadata.Secret,
		mark: metadata.Mark,
		createPerson: metadata.CreatePerson,
		createTime: metadata.CreateTime,
	})

	let result = await CommonService.replaceObject("timages", imageName, tImage);

	return {
		ret: 200,
		msg: 'succ',
		data: result.body
	};
}

// ImageService.imageReleaseCreate = async (metadata) => {


// }
//         let result = await ImageService.imageAdd(ServerId, Id, Image, Secret, Mark, ctx.uid);

module.exports = ImageService;