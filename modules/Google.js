const axios = require("axios");

class Google {
	async clearSheet(url) {
		const preparedData = JSON.stringify({ task: "clear" });
		const response = await axios.post(url, preparedData);

		return response;
	}

	async sendData(data, login, url) {
		const preparedData = JSON.stringify({ task: "add", login, data });
		const response = await axios.post(url, preparedData);

		return response;
	}
}

exports.Google = Google;
