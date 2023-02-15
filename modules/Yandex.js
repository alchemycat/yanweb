const axios = require("axios");

class Yandex {
	userID = null;
	options = null;

	constructor(token) {
		this.options = {
			headers: {
				Authorization: `OAuth ${token}`,
			},
		};
	}

	async getUserID() {
		const response = await axios
			.get("https://api.webmaster.yandex.net/v4/user", this.options)
			.then((res) => res.data)
			.catch((err) => err);

		const { user_id } = response;

		this.userID = user_id;
	}

	async getMainMirror(host) {
		const response = await axios
			.get(
				`https://api.webmaster.yandex.net/v4/user/${this.userID}/hosts/${host}/`,
				this.options,
			)
			.then((res) => res.data.main_mirror)
			.catch((err) => err);

		return response;
	}

	async getHosts() {
		const response = await axios
			.get(
				`https://api.webmaster.yandex.net/v4/user/${this.userID}/hosts`,
				this.options,
			)
			.then((res) => res.data)
			.catch((err) => err);

		let hosts = false;

		if (response.hasOwnProperty("hosts")) {
			hosts = response.hosts;
		}

		return hosts;
	}
}

exports.Yandex = Yandex;
