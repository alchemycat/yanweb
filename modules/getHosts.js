const axios = require("axios");

async function getHosts(token) {
	const options = {
		headers: {
			Authorization: `OAuth ${token}`,
		},
	};

	let response = await axios
		.get("https://api.webmaster.yandex.net/v4/user", {
			headers: {
				Authorization: `OAuth ${token}`,
			},
		})
		.then((res) => res.data)
		.catch((err) => err);

	const { user_id } = response;

	response = await axios
		.get(`https://api.webmaster.yandex.net/v4/user/${user_id}/hosts`, options)
		.then((res) => res.data)
		.catch((err) => err);

	let hosts = false;

	if (response.hasOwnProperty('hosts')) {
		hosts = response.hosts;
	}

	return hosts;
}

exports.getHosts = getHosts;
