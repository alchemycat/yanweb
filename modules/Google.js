const axios = require("axios");

class Google {
	async sendData(data, url) {
		const preparedData = JSON.stringify({ data });
		const response = await axios.post(url, preparedData);

		return response;
	}
}

exports.Google = Google;
