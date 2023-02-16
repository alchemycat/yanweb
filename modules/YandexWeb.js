const chalk = require("chalk");
const axios = require("axios");
const { sleep } = require("./sleep");

class YandexWeb {
	constructor(
		page,
		captcha,
		telegram,
		thread_name,
		loginName,
		login,
		pass,
		answer,
	) {
		this.page = page;
		this.captcha = captcha;
		this.telegram = telegram;
		this.thread_name = thread_name;
		this.loginName = loginName;
		this.login = login;
		this.pass = pass;
		this.answer = answer;
	}

	async isCorrectField() {
		try {
			await this.page.waitForSelector(".Textinput-Hint_state_error", {
				timeout: 5000,
				visible: true,
			});
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

	async setCaptcha() {
		try {
			let tryCounter = 0;
			let isCaptchaExist = true;

			while (isCaptchaExist && tryCounter < 3) {
				tryCounter++;

				console.log(`${chalk.bold(this.thread_name)} Капча найдена`);

				const image = await this.getCaptchaImage();

				if (image) {
					const solution = await this.captcha.resolveCaptcha(image); // Отправляем капчу в capmonster cloud

					const input = await this.page.waitForSelector(
						'input[name="captcha_answer"]',
						{ visible: true },
					);

					await input.click({ clickCount: 3 });
					await input.press("Backspace");

					await this.page.type('input[name="captcha_answer"]', solution);

					await this.page.waitForTimeout(1000);

					await this.page.click(".passp-sign-in-button button");
				}

				await sleep(5000);

				console.log(
					`${chalk.bold(
						this.thread_name,
					)} Повторно проверяю существование капчи`,
				);
				isCaptchaExist = await this.checkCaptchaExist();
			}

			if (isCaptchaExist) {
				console.log(`${chalk.bold(this.thread_name)} Не удалось решить капчу`);
				return false;
			} else {
				console.log(`${chalk.bold(this.thread_name)} Удалось решить капчу`);
				return true;
			}
		} catch {
			return false;
		}
	}

	async getCaptchaImage() {
		try {
			const captchaSrc = await this.page.evaluate(() => {
				const img = document.querySelector(".captcha__image");
				if (!img) return false;
				return img.src;
			});

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
				return false;
			}
			return response;
		} catch {
			return false;
		}
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
				isPhone = await this.getConfirmationCode();
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

	async getConfirmationCode() {
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

	async isQuestion() {
		try {
			await this.page.waitForSelector("#passp-field-question", {
				timeout: 5000,
			});

			return true;
		} catch {
			return false;
		}
	}

	async setAnswer() {
		try {
			await questionField.type(this.answer);
			await this.page.waitForTimeout(1000);
			await this.page.click(".Button2_type_submit");

			return true;
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

		let isCorrect = await this.isCorrectField(); //Проверяем подошел ли логин

		if (!isCorrect) {
			console.log(
				`${chalk.bold(this.thread_name)} Логин для - ${
					this.loginName
				} не подходит`,
			);
			return false;
		}

		let inputPassword = await this.page.waitForSelector("[name='passwd']", {
			visible: true,
		});

		await inputPassword.type(this.pass);

		await this.page.click(".passp-sign-in-button button");

		isCorrect = await this.isCorrectField(); //Проверяем подошел ли логин

		if (!isCorrect) {
			console.log(
				`${chalk.bold(this.thread_name)} Пароль для - ${
					this.loginName
				} не подходит`,
			);
			return false;
		}

		let isCaptchaExist = await this.checkCaptchaExist();

		if (isCaptchaExist) {
			await this.setCaptcha();
		}

		try {
			inputPassword = await this.page.waitForSelector("[name='passwd']", {
				timeout: 5000,
				visible: true,
			});

			await inputPassword.click({ clickCount: 3 });
			await inputPassword.press("Backspace");

			await inputPassword.type(this.pass);

			await this.page.click(".passp-sign-in-button button");

			isCorrect = await this.isCorrectField(); //Проверяем подошел ли логин

			if (!isCorrect) {
				console.log(
					`${chalk.bold(this.thread_name)} Пароль для - ${
						this.loginName
					} не подходит`,
				);
				return false;
			}
		} catch {}

		let isPhoneConfirmationNeed = await this.isPhoneConfirmation();

		if (isPhoneConfirmationNeed) {
			await this.setConfirmationCode();
		}

		let questionField = await this.isQuestion();

		if (questionField) {
			let isAnswerEntered = false;

			if (questionField) {
				isAnswerEntered = await this.setAnswer();
			}

			if (!isAnswerEntered) {
				console.log(
					`${chalk.bold(
						this.thread_name,
					)} не удалось ввести ответ на секретный вопрос`,
				);
				return false;
			}
		}

		//нажимаем кнопку пропустить если нам предлагает установить аватар
		try {
			const skip = await this.page.waitForSelector(
				'.registration__avatar-btn a[href="https://webmaster.yandex.com/sites/"]',
				{ timeout: 4000, visible: true },
			);
			if (skip) {
				await skip.click();
			}
		} catch {}

		await this.page.waitForTimeout(5000);

		return true;
	}
}

exports.YandexWeb = YandexWeb;
