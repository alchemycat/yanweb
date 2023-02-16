const axios = require("axios");

class Captcha {
	data = null;
	key = null;
	task_key = null;
	task_type = "ImageToTextTask";

	constructor(key, moduleName) {
		this.key = key;
		this.task_key = `${key}__${moduleName}`;
	}

	async createTask(task, base64) {
		const data = {
			clientKey: this.task_key,
			task: {
				type: task,
				body: base64,
			},
		};

		const response = await axios.post(
			"https://api.capmonster.cloud/createTask",
			data,
		);

		return response;
	}

	async getTaskResult(taskId) {
		const data = {
			clientKey: this.key,
			taskId: taskId,
		};
		return await axios
			.post("https://api.capmonster.cloud/getTaskResult/", data)
			.catch((err) => {
				return err;
			});
	}

	async getBalance() {
		const data = {
			clientKey: this.key,
		};
		return axios
			.post("https://api.capmonster.cloud/getBalance", data)
			.catch((err) => {
				return err;
			});
	}

	async resolveCaptcha(image) {
		return new Promise(async (resolve) => {
			try {
				let res = await this.createTask(this.task_type, image);

				let task_id;

				if (res.data.taskId) {
					task_id = res.data.taskId;

					let counter = 0;
					let solution = null;

					const id = setInterval(async () => {
						const res = await this.getTaskResult(task_id);
						counter++;
						if (res.data) {
							if (res.data.status === "ready") {
								clearInterval(id);
								solution = res.data.solution.text;
								resolve(solution);
							} else {
								console.log("Капча еще не готова");
							}
						}

						if (counter >= 6) {
							clearInterval(id);
							resolve(false);
						}
					}, 5000);
				} else {
					is_working = false;
					console.log("Не удалось создать задачу на решение капчи");
					resolve(false);
				}
			} catch (err) {
				console.log(err);
				resolve(false);
			}
		});
	}
}

exports.Captcha = Captcha;
