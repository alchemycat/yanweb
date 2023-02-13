const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

//my modules
const { Session } = require("./modules/session");
const { getHosts } = require("./modules/getHosts");

//data
const token = process.env.OAUTH;
const login = process.env.LOGIN;
const pass = process.env.PASS;
const sessionFolder = `${__dirname}/profiles`;

async function main() {
	const hosts = await getHosts(token);

	if (!hosts.length)
		return console.log("Не удалось получить данные о доменах на аккаунте");

	//host_id это юрл который подставляем при проверке статуса переезда
	//unicode_host_url это юрл в стандартном виде

	const browser = await puppeteer.launch({
		headless: false,
		slowMo: 20,
		ignoreHTTPSErrors: true,
		ignoreDefaultArgs: ["--enable-automation"],
	});

	const page = await browser.newPage();

	page.setDefaultTimeout(20000);

	const session = new Session(page, `${__dirname}/profiles`);

	await page.goto(
		"https://passport.yandex.com/auth?mode=auth&retpath=https%3A%2F%2Fwebmaster.yandex.com%2Fsites%2F",
	);

	if (fs.existsSync(`${sessionFolder}/cookies.json`)) {
		await session
			.loadSession()
			.then(() => {
				console.log("session is load");
			})
			.catch((err) => {
				console.log(err);
				console.log("error session load");
			});
	}

	await page.reload();

	let isLogin = false;

	try {
		isLogin = await page.waitForSelector("#passp-field-login", {
			timeout: 8000,
		});
	} catch {}

	if (isLogin) return console.log("Создайте новую сессию");

	if (!isLogin) {
		const selectAccount = await page.waitForSelector(
			"a[href='https://webmaster.yandex.com/sites/']",
		);

		if (selectAccount) {
			await selectAccount.click();
		}

		await page.waitForSelector(".UserID-Account");
		console.log("Выполнен вход в аккаунт Яндекс Вебмастер");

		let result = [];

		for (let i = 0; i < hosts.length; i++) {
			let host = hosts[i].host_id;
			let url = hosts[i].unicode_host_url;

			console.log("Всего сайтов:", hosts.length);
			console.log("Счетчик:", i + 1);
			console.log("Текущий хост:", host);
			if (host) {
				await page.goto(
					`https://webmaster.yandex.com/site/${host}/indexing/mirrors/`,
				);

				try {
					await page.waitForSelector(".MirrorsContent-Suggest", {
						timeout: 5000,
					});
					const notifcationText = await page.evaluate(() => {
						const text = document.querySelector(".MirrorsAlert-Content");
						if (text) {
							return text.textContent;
						} else {
							return "null";
						}
					});

					result.push([url, notifcationText]);

					await page.waitForTimeout(1000);
				} catch (err) {
					result.push([url, "error"]);
					console.log(err);
				}
			}
		}

		console.log(result);
	} else {
		console.log("page loaded");

		try {
			await page.click("[data-id='button-all']");
			console.log("cookie button not found");
		} catch {
			console.log("cookie button clicked");
		}

		await page.type("#passp-field-login", login);

		await page.click(".passp-sign-in-button button");

		console.log("login added");

		await page.waitForSelector("[name='passwd']");

		console.log("pass field finded");
		await page.type("[name='passwd']", pass);
		console.log("pass added");

		await page.click(".passp-sign-in-button button");

		try {
			await page.waitForSelector("[name='captcha_answer']");
			console.log("captcha found");
			await page.waitForTimeout(20000);
		} catch {
			console.log("captcha not found");
			console.log("logged in");
		}

		console.log("waiting 15 sec and save session");

		await page.waitForTimeout(15000);

		session
			.saveSession()
			.then(() => {
				console.log("session saved");
			})
			.catch((err) => {
				console.log("error can't save session");
			});
	}
}

main();
