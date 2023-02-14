const fs = require("fs");

class Session {
	constructor(page, saveFolder) {
		this.page = page;
		this.folder = saveFolder;
		//by default folder = ./profiles
	}

	async saveSession() {
		return new Promise(async (resolve, reject) => {
			try {
				const cookies = JSON.stringify(await this.page.cookies());

				// const sessionStorage = await this.page.evaluate(() =>
				// 	JSON.stringify(sessionStorage),
				// );

				// const localStorage = await this.page.evaluate(() =>
				// 	JSON.stringify(localStorage),
				// );

				if (!fs.existsSync(`${this.folder}/cookies.json`)) {
				}

				fs.writeFileSync(`${this.folder}/cookies.json`, cookies);
				// fs.writeFileSync(`${this.folder}/sessionStorage.json`, sessionStorage);
				// fs.writeFileSync(`${this.folder}/localStorage.json`, localStorage);
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

				// if (fs.existsSync(`${this.folder}/sessionStorage.json`)) {
				// 	const sessionStorageString = fs.readFileSync(
				// 		`${this.folder}/sessionStorage.json`,
				// 		{
				// 			encoding: "utf-8",
				// 		},
				// 	);
				// 	const sessionStorage = JSON.parse(sessionStorageString);

				// 	await this.page.evaluate((data) => {
				// 		for (const [key, value] of Object.entries(data)) {
				// 			sessionStorage[key] = value;
				// 		}
				// 	}, sessionStorage);
				// }

				// if (fs.existsSync(`${this.folder}/localStorage.json`)) {
				// 	const localStorageString = fs.readFileSync(
				// 		`${this.folder}/localStorage.json`,
				// 		{
				// 			encoding: "utf-8",
				// 		},
				// 	);
				// 	const localStorage = JSON.parse(localStorageString);

				// 	await this.page.evaluate((data) => {
				// 		for (const [key, value] of Object.entries(data)) {
				// 			localStorage[key] = value;
				// 		}
				// 	}, localStorage);
				// }
				resolve();
			} catch (err) {
				reject(err);
			}
		});
	}
}

exports.Session = Session;
