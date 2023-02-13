const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

//my modules
const { Session } = require("./modules/session");

//data
const token = process.env.OAUTH;
const login = process.env.LOGIN;
const pass = process.env.PASS;
const sessionFolder = `${__dirname}/profiles`;

async function main() {
	const options = {
		headers: {
			Authorization: `OAuth ${token}`,
		},
	};
	// let response = await axios.get("https://api.webmaster.yandex.net/v4/user", {headers: {
	//     'Authorization': `OAuth ${token}`
	// }}).then(res => res.data).catch(err => err);

	// const {user_id} = response;
	// console.log(user_id);

	// const userId = 1469382668;

	// let response = await axios
	// 	.get(`https://api.webmaster.yandex.net/v4/user/${userId}/hosts`, options)
	// 	.then((res) => res.data)
	// 	.catch((err) => err);

	// const { hosts } = response;

	// console.log(hosts);

	// const filePath = `${__dirname}/hosts.txt`;

	// hosts.forEach(host => {
	//     fs.appendFileSync(filePath, `${host.host_id}\n`, {encoding: "utf-8"})
	// });

	// https://webmaster.yandex.com/site/https:betwinner2.ru:443/indexing/mirrors/

	const browser = await puppeteer.launch({
		headless: false,
		slowMo: 20,
		ignoreHTTPSErrors: true,
		ignoreDefaultArgs: ["--enable-automation"],
	});

	const page = await browser.newPage();

	page.setDefaultTimeout(5000);

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
		isLogin = await page.waitForSelector("#passp-field-login");
	} catch {}

	if (!isLogin) {
		console.log("check is logged in");
		const selectAccount = await page.waitForSelector(
			"a[href='https://webmaster.yandex.com/sites/']",
		);
        
		if (selectAccount) {
		    await selectAccount.click();
		}

		// await page.goto("https://webmaster.yandex.com/sites/");
		await page.waitForSelector(".UserID-Account");
		console.log("Выполнен вход в аккаунт Яндекс Вебмастер");
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
