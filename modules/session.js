const fs = require("fs");

class Session {
	constructor(page, saveFolder) {
		this.page = page;
		this.folder = saveFolder;
	}

	async saveSession() {
		return new Promise(async (resolve, reject) => {
			try {
				const cookies = JSON.stringify(await this.page.cookies());

				if (!fs.existsSync(`${this.folder}/cookies.json`)) {
				}

				fs.writeFileSync(`${this.folder}/cookies.json`, cookies);

				resolve(true);
			} catch (err) {
				reject(err);
			}
		});
	}

	async loadSession() {
		return new Promise(async (resolve, reject) => {
			try {
				if (fs.existsSync(`${this.folder}/cookies.json`)) {
					const cookiesString = fs.readFileSync(`${this.folder}/cookies.json`, {
						encoding: "utf-8",
					});
					const cookies = JSON.parse(cookiesString);
					await this.page.setCookie(...cookies);
				}
				resolve();
			} catch (err) {
				reject(err);
			}
		});
	}
}

exports.Session = Session;
