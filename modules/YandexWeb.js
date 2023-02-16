const chalk = require("chalk");
const axios = require("axios");
const { sleep } = require("./sleep");

class YandexWeb {
	constructor(page, captcha, telegram, thread_name, loginName, login, pass, answer) {
		this.page = page;
		this.captcha = captcha;
		this.telegram = telegram;
		this.thread_name = thread_name;
		this.loginName = loginName;
		this.login = login;
		this.pass = pass;
		this.answer = answer;
	}

	async isCorrectField(fieldName) {
		try {
			await this.page.waitForSelector(".Textinput-Hint_state_error", {
				timeout: 5000,
				visible: true,
			});
			console.log(
				`${chalk.bold(this.thread_name)} ${fieldName}: для ${
					this.loginName
				} не подходит`,
			);
			return false;
		} catch {
			return true;
		}
	}

	async checkCaptchaExist() {
		try {
			await this.page.waitForSelector("[name='captcha_answer']", {
				timeout: 5000,
				visible: true,
			});

			return true;
		} catch {
			return false;
		}
	}

	async solveCaptcha() {
		try {
			let tryCounter = 0;

			while (isCaptchaExist && tryCounter < 3) {
				tryCounter++;
				console.log(`${chalk.bold(this.thread_name)} Капча найдена`);
				await this.getCaptcha();
				await sleep(5000);
				console.log(
					`${chalk.bold(
						this.thread_name,
					)} Повторно проверяю существование капчи`,
				);
				isCaptchaExist = await this.checkCaptchaExist();
			}

			if (isCaptchaExist) {
				return false;
			} else {
				return true;
			}
		} catch {
			return false;
		}
	}

	async getCaptcha() {
		try {
			const captchaSrc = await this.page.evaluate(() => {
				const img = document.querySelector(".captcha__image");
				if (!img) return false;
				return img.src;
			});

			console.log(
				`${chalk.bold(this.thread_name)} Ссылка на капчу: ${captchaSrc}`,
			);

			if (!captchaSrc) return false;

			const response = await axios
				.get(captchaSrc, {
					responseType: "text",
					responseEncoding: "base64",
				})
				.then((response) => response.data)
				.catch((err) => {
					console.log(err);
					return false;
				});

			if (!response) {
				console.log(`${chalk.bold(this.thread_name)}`);
				return false;
			}

			const solution = await this.captcha.resolveCaptcha(response); // Отправляем капчу в capmonster cloud

			if (!solution) {
				console.log(`${chalk.bold(this.thread_name)} Не удалось решить капчу`);
				return false;
			}

			await this.page.type('input[name="captcha_answer"]', solution);

			await this.page.waitForTimeout(1000);

			await this.page.click(".passp-sign-in-button button");
		} catch {}
	}

	async isPhoneConfirmation() {
		try {
			await this.page.waitForSelector(
				"[data-t='challenge_sumbit_phone-confirmation']",
				{
					timeout: 5000,
					visible: true,
				},
			);

			await this.page.click(".Button2_type_submit");

			return true;
		} catch {
			return false;
		}
	}

	async setConfirmationCode() {
		try {
			let tryCounter = 0;

			let isPhone;

			while (!isPhone && tryCounter < 3) {
				tryCounter++;
				if (tryCounter >= 2) {
					console.log("Код веден не верно, введите код повторно");
				}
				isPhone = await checkPhoneConfirmation();
				await sleep(2000);
				console.log(tryCounter);
			}

			if (isPhone) {
				console.log(`${chalk.bold(this.thread_name)} Код введен верно`);
			} else {
				return console.log(
					`${chalk.bold(this.thread_name)} Не удалось ввести код`,
				);
			}
		} catch {
			return false;
		}
	}

	async loginToWebmaster() {
		try {
			await this.page.click("[data-id='button-all']", { timeout: 4000 });
		} catch {}

		await this.page.type("#passp-field-login", this.login);

		await this.page.click(".passp-sign-in-button button");

		let isCorrect = await this.isCorrectField("Логин"); //Проверяем подошел ли логин

		if (!isCorrect) return false;

		await this.page.waitForSelector("[name='passwd']", { visible: true });

		await this.page.type("[name='passwd']", this.pass);

		isCorrect = await this.isCorrectField("Пароль"); //Проверяем подошел ли логин

		if (!isCorrect) return false;

		await this.page.click(".passp-sign-in-button button");

		let isCaptchaExist = await this.checkCaptchaExist();

		if (isCaptchaExist) {
			await this.solveCaptcha();
		}

		let isPhoneConfirmationNeed = await this.isPhoneConfirmation();

		if (isPhoneConfirmationNeed) {
		}

		async function checkPhoneConfirmation() {
			try {
				const isExist = await this.page.waitForSelector(
					"#passp-field-phoneCode",
					{
						timeout: 5000,
						visible: true,
					},
				);

				if (!isExist) return true;

				const code = await this.telegram.getCode(
					this.thread_name,
					this.loginName,
				);

				await this.page.type("#passp-field-phoneCode", code);

				await this.page.click(".Button2_type_submit");

				await this.page.waitForSelector(".UserID-Account", {
					timeout: 5000,
					visible: true,
				});

				return true;
			} catch (err) {
				return false;
			}
		}

		let questionField;

		try {
			questionField = await this.page.waitForSelector("#passp-field-question", {
				timeout: 5000,
			});
		} catch {}

		if (questionField) {
			await questionField.type(this.answer);
			await this.page.waitForTimeout(1000);
			await this.page.click(".Button2_type_submit");
		}

		await this.page.waitForTimeout(5000);

		session
			.saveSession()
			.then(() => {
				console.log(
					`${chalk.bold(
						this.thread_name,
					)} Профиль для аккаунта: ${this.login} сохранен`,
				);
			})
			.catch((err) => {
				console.log(err);
				console.log(
					`${chalk.bold(
						this.thread_name,
					)} Не удалось сохранить профиль для аккаунта: ${this.login}`,
				);
			});
	}
}
