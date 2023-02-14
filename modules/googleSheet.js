const axios = require("axios");

class GoogleSheet {
	async sendData(data, url) {
        const preparedData = JSON.stringify({data});
		const response = await axios.post(
			url, preparedData
		);

        return response;
	}
}

exports.GoogleSheet = GoogleSheet;