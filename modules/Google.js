const axios = require("axios");

class Google {
	async sendData(data, login, url) {
		const preparedData = JSON.stringify({ login, data });
		const response = await axios.post(url, preparedData);

		return response;
	}
}

exports.Google = Google;
