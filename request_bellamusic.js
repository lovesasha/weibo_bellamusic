var fs = require('fs')
var http = require('http')
var cheerio = require('cheerio')
var Promise = require('bluebird')


function request(path, type) {
	
	return new Promise(function(resolve, reject) {
		var requestOptions = {
			hostname: 'weibo.com',
			port: 80,
			path: '',
			method: 'GET',
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Encoding': 'deflate, sdch',
				'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
				'Connection': 'keep-alive',
				'Upgrade-Insecure-Requests': 1,
				'Content-Type': 'text/html; charset=UTF-8',
			}
		}
		
		requestOptions.headers['Cookie'] = options.cookie
		requestOptions.path = path

		http.request(requestOptions, function(res) {
			
			var html = '';
			
			res.on('data', function(chunk) {
				html += chunk.toString()
			})
			
			res.on('end', function() {
				if (type == 1) {  // 解析主页面
					parseHTML(html)
				} else if (type == 2) {  // 解析分页JSON
					getDetail(JSON.parse(html).data)
				}
				resolve()
			})
			
		}).end()
	})
	
}


function parseHTML(html) {
	var $ = cheerio.load(html)
	
	var script = $('script');
	script.each(function(index, item) {
		var tx = script.eq(index).text();
		if (tx.indexOf('comb_WB_feed_profile') > 0) {
			var view = JSON.parse(tx.substring(tx.indexOf('(') + 1, tx.lastIndexOf(')')))
			// 获取每条微博详细情况
			getDetail(view.html)
		}
	})
	
}


function getDetail(data) {
	$ = cheerio.load(data)
	var items = $('[action-type="feed_list_item"]')
	
	items.each(function(index, item) {
		item = $(item)
		var detail = item.children().eq(0)
		var handle = item.children().eq(1)
		
		var time = detail.find('[node-type="feed_list_item_date"]').eq(0).text().trim() // 取第一个，非转发的原文时间
		var content = detail.find('[node-type="feed_list_content"]').text().trim()
		
		//console.log('时间:' + time)
		//console.log('内容:' + content)
		weiboContent += '时间:' + time + '\n'
		weiboContent += '内容:' + content + '\n'
		
		var forwards = handle.find('[node-type="forward_btn_text"] em').eq(1).text().trim()  // 转发数
		var comments = handle.find('[node-type="comment_btn_text"] em').eq(1).text().trim()  // 评论数
		var likes = handle.find('[node-type="like_status"] em').eq(1).text().trim()          // 点赞数
		
		var media = detail.find('[node-type="feed_list_content"]').next('.WB_media_wrap')  // 微博图片
		if (media.length > 0) {
			media.find('img').each(function(index, img) {
				//console.log($(img).attr('src'))
				weiboContent += $(img).attr('src') + '\n'
			})
		}
		
		var expand = detail.find('[node-type="feed_list_forwardContent"]')  // 转发原文
		if (expand.length > 0) {
			var origin_time = expand.find('[node-type="feed_list_item_date"]').text().trim()
			var origin_content = expand.find('[node-type="feed_list_reason"]').text().trim()
			//console.log('	原文时间:' + origin_time)
			//console.log('	原文内容:' + origin_content)
			weiboContent += '	原文时间:' + origin_time + '\n'
			weiboContent += '	原文内容:' + origin_content + '\n'
			
			var media = expand.find('.media_box img')
			if (media.length > 0) {
				//console.log('	原文图片:')
				weiboContent += '	原文图片:' + '\n'
				media.each(function(i, img) {
					//console.log('	' + $(img).attr('src'))
					weiboContent += '	' + $(img).attr('src') + '\n'
				})
			}
		}
		
		//console.log('转发:' + forwards + ' 评论:' + comments + ' 赞:' + likes)
		//console.log('\n')
		weiboContent += '转发:' + forwards + ' 评论:' + comments + ' 赞:' + likes + '\n\n'
	})
	
}


function writeFile(data) {
	return new Promise(function(resolve, reject) {
		fs.writeFile('./weibo.txt', data, function(err) {
			if (err) {
				throw err;
			}
			resolve()
		})
	})
}


var weiboContent = ''

var count = 1

function main() {
	request('/u/' + options.uid + '?page=' + count, 1)
	.then(function() {
		request('/p/aj/v6/mblog/mbloglist?domain=100406&is_all=1&pagebar=0&id=' + options.id + '&page=' + count + '&pre_page=' + count, 2)
		.then(function() {
			request('/p/aj/v6/mblog/mbloglist?domain=100406&is_all=1&pagebar=1&id=' + options.id + '&page=' + count + '&pre_page=' + count, 2)
			.then(function() {
				console.log('>' + (new Date().getTime() - startTime) + 'ms:第' + count + '页爬取完毕')
				
				if (count ++ < 1) {
					main()
				} else {
					writeFile(weiboContent).then(function() {
						var total = new Date().getTime() - startTime
						console.log('保存完毕')
						console.log('操作完成，耗时：' + total + '毫秒')
						process.exit()
					})
				}
			})
		})
	})
}

var options = {
	// 滚动分页在开发者工具网络监控中寻找一个mbloglist的参数
	id: 1005055475805298,
	// 用户ID，大V请修改第一个request中的链接，否则微博会进行302重定向
	uid: 5475805298,
	// 随便一个ajax请求中携带的cookie信息
	cookie: 'TC-Page-G0=b05711a62e11e2c666cc954f2ef362fb; login_sid_t=c3e4bb36910cccb284baa6db4055abe2; TC-Ugrow-G0=e66b2e50a7e7f417f6cc12eec600f517; TC-V5-G0=c427b4f7dad4c026ba2b0431d93d839e; WBStore=df68f4b9b444a084|undefined; _s_tentry=-; Apache=5167893170267.084.1471100842780; SINAGLOBAL=5167893170267.084.1471100842780; ULV=1471100842825:1:1:1:5167893170267.084.1471100842780:; YF-V5-G0=5468b83cd1a503b6427769425908497c; YF-Page-G0=f0e89c46e7ea678e9f91d029ec552e92; YF-Ugrow-G0=1eba44dbebf62c27ae66e16d40e02964; appkey=; SSOLoginState=1476628565; WBtopGlobal_register_version=058ac28f5e23153a; wvr=6; __utma=182865017.1632129595.1474467321.1474467321.1477115198.2; __utmc=182865017; __utmz=182865017.1477115198.2.2.utmcsr=weibo.com|utmccn=(referral)|utmcmd=referral|utmcct=/bellamusic; SCF=AtZzPiyiOZvhYVJuLaqcPz3IBafQ07Gvfst09pXrrMcxqiIuE8ucEwuBGtcOnbsbKa9bGFD8PVjytb-9JiZhXsM.; SUB=_2A251CbSODeTxGedI7VQZ8izPzjuIHXVWfqFGrDV8PUNbmtBeLRLAkW9OyNxmCQWtoEJBrMv1FeR1A55f3A..; SUBP=0033WrSXqPxfM725Ws9jqgMF55529P9D9Whqxxd2LVmFdnJ0fV4bpk_N5JpX5K2hUgL.Fo2cSoqReoz0SKM2dJLoIEBLxKnLBoBL1-BLxK-LBKeLBoeLxKnL12qL1-eLxKnL12qL1-et; SUHB=0LcDBhMCzaIrLh; ALF=1508833374;'
}

var startTime = new Date().getTime()

main()

