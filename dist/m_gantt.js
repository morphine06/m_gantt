/*!
 * m_gantt v0.1.1
 * Docs & License: http://????
 * (c) 2014 David Miglior (3doubleV)
 */

"use strict";

(function(factory) {
	if (typeof define === 'function' && define.amd) {
		define([ 'jquery', 'moment' ], factory);
	}
	else {
		factory(jQuery, moment);
	}
})(function($, moment) {



var defaults = {
	lang: 'en',
	aspectRatio: 0,
	height: 0,
	labelsWidth: 0,
	firstDay: 1,
	start: moment(),
	end: moment().add(3, 'months'),
	tasks: [],
	thresholdWarning: 70,
	thresholdDanger: 90,
	advancesNotOverflow: false,
	daysWorked: [0, 100, 100, 100, 100, 100, 0],
	textRessources: "Ressources (other projects taken into account)",
	project: '', // ID of current project to display

	// beforeRender: function() {},
	// afterRender: function() {},
	// clickTask: function() {},


	gridDays: {
		width: 32,
		height: 32,
		ressourceWidth: 30,
		ressourceHeight: 30,
		img: 'm_gantt-bg.gif', // relative to css
		// heightHeaderLine: 20,
		barHeight: 20
	}
} ;


var mg = $.m_gantt = { version: "0.1.2" };


// classic jQuery plugin ; I don't comment
$.fn.m_gantt = function(options) {
	var args = Array.prototype.slice.call(arguments, 1);
	var res = this;
	this.each(function(i, _element) {
		var element = $(_element);
		var gantt = element.data('m_gantt'); 
		var singleRes; 
		if (typeof options === 'string') {
			if (gantt && $.isFunction(gantt[options])) {
				singleRes = gantt[options].apply(gantt, args);
				if (!i) res = singleRes; 
				if (options === 'destroy') element.removeData('m_gantt');
			}
		} else if (!gantt) { // don't initialize twice
			gantt = new m_gantt(element, options);
			element.data('m_gantt', gantt);
			gantt.render();
		}
	});
	return res;
};


// More interesting...
function m_gantt(element, instanceOptions) {
	var me = this;

	var opts = $.extend(true, {}, defaults, instanceOptions) ;

	opts.start = moment(opts.start).startOf('day') ;
	opts.end = moment(opts.end).startOf('day') ;


	// Exports
	me.render = render ;
	me.sayHello = sayHello ;
	me.addTask = addTask ;
	me.removeTask = removeTask ;
	me.getTask = getTask ;
	me.getIndexTask = getIndexTask ;
	me.getParents = getParents ;
	me.opts = opts ;

	// local variables 
	var grid = opts.gridDays ;
	var tasks = opts.tasks ;
	var ressources = opts.ressources ;
	var projects = opts.projects ;

	var tabBars = {} ;
	var gridjEl = null ;
	var _jElToMove = null ;
	var currentMouseEvtType = 'click' ;
	var _deltaX = 0 ;
	var movePreviousLeft = -1 ;
	var rendered = false ;
	var mainDiv = null ;

	// for debug
	function log() {
		if (window.console) console.log.apply(window.console, arguments) ;
	}

	// function getMinMaxParent(i1, min1, max1) {
	// 	var i1, j1 ;
	// 	if (tasks[i1].parent && tasks[i1].parent!=='') {
	// 		for(j1=0 ; j1<tasks.length ; j1++) {
	// 			if (tasks[j1].id==tasks[i1].parent) {
	// 				if (!tasks[j1].start) {
	// 					tasks[j1].start = moment(tasks[i1].start) ;
	// 					tasks[j1].end = moment(tasks[i1].end) ;
	// 				} else if (!tasks[i1].start) {

	// 				} else {
	// 					tasks[j1].start = moment(moment.min(tasks[j1].start, tasks[i1].start)) ;
	// 					tasks[j1].end = moment(moment.max(tasks[j1].end, tasks[i1].end)) ;
	// 				}
	// 				getMinMaxParent(j1) ;
	// 			}
	// 		}
	// 	}

	// 	// if (tasks[i1].parent && tasks[i1].parent!=='') {
	// 	// 	for(j1=0 ; j1<tasks.length ; j1++) {
	// 	// 		if (tasks[j1].id==tasks[i1].parent) {
	// 	// 			if (!tasks[j1].start) {
	// 	// 				tasks[j1].start = moment(tasks[i1].start) ;
	// 	// 				tasks[j1].end = moment(tasks[i1].end) ;
	// 	// 			} else {
	// 	// 				tasks[j1].start = moment(moment.min(tasks[j1].start, tasks[i1].start)) ;
	// 	// 				tasks[j1].end = moment(moment.max(tasks[j1].end, tasks[i1].end)) ;
	// 	// 			}
	// 	// 			getMinMaxParent(j1) ;
	// 	// 			break ;
	// 	// 		}
	// 	// 	}
	// 	// }

	// }
	function uniformizeDatas() {
		var i = 0, j = 0, k = 0 ;
		for (k=0 ; k<ressources.length ; k++) {
			ressources[k].work = {} ;
			if (!ressources[k].daysWorked) ressources[k].daysWorked = opts.daysWorked ;
		}
		for(i=0 ; i<projects.length ; i++) {
			projects[i].id = projects[i].id || ('_proj'+i) ;
			projects[i].start = null ;
			projects[i].end = null ;
		}
		for(i=0 ; i<tasks.length ; i++) {
			tasks[i].id = tasks[i].id || ('_bar'+i) ;
			tasks[i].name = tasks[i].name || "" ;
			tasks[i].textLabel = tasks[i].textLabel || "" ;
			tasks[i].project = tasks[i].project || opts.project || "" ;
			// log("tasks[i].project",tasks[i].project)
			tasks[i].hasChilds = false ;
			// tasks[i].start = moment(tasks[i].start) ;
			// tasks[i].end = moment(tasks[i].end) ;
			tasks[i].start = (moment.isMoment(tasks[i].start))?tasks[i].start:moment(tasks[i].start) ;
			tasks[i].end = (moment.isMoment(tasks[i].end))?tasks[i].end:moment(tasks[i].end) ;
			tasks[i].diff = tasks[i].end.diff(tasks[i].start, 'days') ;
			tasks[i].nbWorkedDays = 0 ;
			var currentDate1 = moment(tasks[i].start) ;
			while(currentDate1.isBefore(tasks[i].end)) {
				if (opts.daysWorked[currentDate1.day()]) tasks[i].nbWorkedDays++ ;
				currentDate1.add(1, 'days') ;
			}
			// log(tasks[i].nbWorkedDays)
			// log("tasks[i].diff",tasks[i].diff)
		}
		for(i=0 ; i<tasks.length ; i++) {
			if (tasks[i].parent && tasks[i].parent!=='') {
				// getMinMaxParent(i) ;
				for(j=0 ; j<tasks.length ; j++) {
					if (tasks[j].id==tasks[i].parent) {
						tasks[j].hasChilds = true ;
						tasks[j].start = null ;
						tasks[j].end = null ;
					}
				}
			}
		}
		for(i=0 ; i<tasks.length ; i++) {
			var parents = getParents(i) ;
			if (!tasks[i].hasChilds) {
				for(j=0 ; j<parents.length ; j++) {
					if (!tasks[parents[j]].start) {
						tasks[parents[j]].start = moment(tasks[i].start) ;
						tasks[parents[j]].end = moment(tasks[i].end) ;
					} else {
						tasks[parents[j]].start = moment(moment.min(tasks[parents[j]].start, tasks[i].start)) ;
						tasks[parents[j]].end = moment(moment.max(tasks[parents[j]].end, tasks[i].end)) ;
					}
				}
			}
		}
		// log("tata")
		for(i=0 ; i<tasks.length ; i++) {
			tasks[i]._projectName = "" ;
			tasks[i]._projectIndex = -1 ;
			var indTemp =  getIndexProject(tasks[i].project) ;
			if (indTemp>=0) {
				tasks[i]._projectName = projects[indTemp].name ;
				tasks[i]._projectIndex = indTemp ;
				if (projects[indTemp].start) projects[indTemp].start = moment(moment.min(projects[indTemp].start, tasks[i].start)) ;
				else projects[indTemp].start = moment(tasks[i].start) ;
				if (projects[indTemp].end) projects[indTemp].end = moment(moment.max(projects[indTemp].end, tasks[i].end)) ;
				else projects[indTemp].end = moment(tasks[i].end) ;
			}
			if (tasks[i].assign) {
				for(j=0 ; j<tasks[i].assign.length ; j++) {
					for (k=0 ; k<ressources.length ; k++) {
						if (tasks[i].assign[j][0]==ressources[k].id) {
							var currentDate2 = moment(tasks[i].start) ;
							while(currentDate2.isBefore(tasks[i].end)) {
								if (ressources[k].daysWorked[currentDate2.day()] && !tasks[i].hasChilds) {
									if (!ressources[k].work[currentDate2.format('YYYY-MM-DD')]) ressources[k].work[currentDate2.format('YYYY-MM-DD')] = 0 ;
									ressources[k].work[currentDate2.format('YYYY-MM-DD')] += tasks[i].assign[j][1] ;
								}
								currentDate2.add(1, 'days') ;
							}
						}
					}
				}
			}
		}
		// for (i=0 ; i<ressources.length ; i++) {}
		// sort by project
		tasks.sort(function(a, b) {
			if (a._projectName > b._projectName) return 1 ;
			if (a._projectName < b._projectName) return -1 ;
			return 0 ;
		}) ;
		// log("tasks",tasks)
		// log("ressources",ressources)
	}

	// don't create / re-create dom, resize all components
	function redraw() {

	}

	// the first render, create all main divs
	function firstRender() {
		mainDiv = $(""+
			"<div class='m_gantt'>"+
				"<div class='m_gantt-relative'></div>"+
				"<div class='m_gantt-col-labels'></div>" +
				"<div class='m_gantt-col-center'>"+
					"<div class='m_gantt-grid-header'></div>"+
					"<div class='m_gantt-grid'></div>"+
					"<div class='m_gantt-ressources-header'></div>"+
					"<div class='m_gantt-ressources'></div>"+
					"<div class='m_gantt-scrollspace'></div>"+
				"</div>"+
				"<div class='m_gantt-col-sums'></div>"+
				"<div class='m_gantt-clear'></div>"+
			"</div>"
		) ;
		element.append(mainDiv) ;
		// and set rendered = true
		rendered = true ;
	}

	// draw the tasks
	function render() {
		if (opts.beforeRender && opts.beforeRender()===false) return ;
		if (!rendered) firstRender() ;

		mainDiv.find(".m_gantt-col-labels").empty() ;
		mainDiv.find(".m_gantt-grid-header").empty() ;
		mainDiv.find(".m_gantt-grid").empty() ;
		mainDiv.find(".m_gantt-col-sums").empty() ;
		mainDiv.find(".m_gantt-ressources").empty() ;
		mainDiv.find(".m_gantt-ressources-header").empty() ;
		mainDiv.find(".m_gantt-relative").empty() ;

		var h = 0 ;
		if (opts.height && opts.height!='auto' && opts.height>0) h = opts.height ;
		else if (opts.aspectRatio>0) h = mainDiv.width()*opts.aspectRatio ;
		if (h>0) mainDiv.height(h) ;
		if (opts.textRessources!=='') mainDiv.find('.m_gantt-ressources-header').html(opts.textRessources) ;
		mainDiv.find('.m_gantt-col-labels').width(opts.labelsWidth) ;
		mainDiv.find('.m_gantt-col-center').width(mainDiv.width() - (mainDiv.find('.m_gantt-col-labels').width() + mainDiv.find('.m_gantt-col-sums').width())) ;

		var start = opts.start,
			end = moment(opts.end).startOf('day'),
			endMinusOne = moment(end).subtract(1,'days').startOf('day'),
			d = moment(start).startOf('day'),
			html1 = "",
			html2 = "",
			html3 = "",
			nbDays = 0,
			nbColSpan = 0 ;
		while (d.isBefore(end)) {
			html1 += "<td>"+d.format('dd')+"</td>" ;
			html2 += "<td>"+d.format('D')+"</td>" ;
			nbColSpan++ ;
			if (d.format('D')*1==d.daysInMonth() || d.isSame(endMinusOne)) {
				html3 += "<td colspan='"+nbColSpan+"'>"+d.format('MMMM YYYY')+"</td>" ;
				nbColSpan = 0 ;
			}
			d.add(1, 'days') ;
			nbDays++ ;
		}
		mainDiv.find('.m_gantt-grid-header').append("<table><tr class='m_gantt-grid-header-dayofweek'>"+html1+"</tr><tr class='m_gantt-grid-header-day'>"+html2+"</tr><tr class='m_gantt-grid-header-month'>"+html3+"</td></tr></table>").width(grid.width*nbDays) ;
		mainDiv.find('.m_gantt-grid-header table').width(grid.width*nbDays) ;
		mainDiv.find('.m_gantt-grid-header table').width(grid.width*nbDays) ;
		// start.day() 
		gridjEl = mainDiv.find('.m_gantt-grid').css('background-position', grid.width*(1-start.day())+'px 0').data("opts", grid) ;

		// set hasChilds and recalculate date of parents
		uniformizeDatas() ;
		// uniformizeDatas() ;
		// log("tasks",tasks)

		var nbBars = 0 ;
		var previousProjectId = "__1__" ;
		for(var i=0 ; i<tasks.length ; i++) {
			var task = tasks[i] ;
			if (opts.project!=='' && task.project!=opts.project) continue ;


			if (opts.project==='' && task.project!=previousProjectId) {
				var project = projects[task._projectIndex] ;
				var projectjEl = $("<div class='m_gantt-project'><div class='m_gantt-text'>"+project.name+"</div></div>") ;
				projectjEl.append($("<div class='m_gantt-group-arrow-left'></div>")) ;
				projectjEl.append($("<div class='m_gantt-group-arrow-right'></div>")) ;
				projectjEl.data("project", project.id) ;
				// log("project.end",project.start,project.end)
				var diffP1 = moment(project.end).startOf('day').diff(moment(project.start).startOf('day'), 'days') ;
				var diffP2 = moment(project.start).startOf('day').diff(start, 'days') ;
				gridjEl.append(projectjEl) ;
				// projectjEl ; //.height(grid.barHeight) ;
				var wArrow1 = parseInt(projectjEl.find('.m_gantt-group-arrow-left').css('border-left-width'),10) ;
				projectjEl.css('top', nbBars*grid.height+((grid.height-grid.barHeight)/2))
				          .css('left', grid.width*diffP2-wArrow1)
				          .width(grid.width*diffP1+wArrow1*2) ;
				nbBars++ ;
			}
			previousProjectId = task.project ;

			var cls = 'm_gantt-task' ;
			if (task.hasChilds) cls = 'm_gantt-group' ;
			var bar = $("<div class='"+cls+"'><div class='m_gantt-text'>"+task.name+"</div></div>") ;
			if (task.nbUnitsToBeMade && task.nbUnitsMade && !task.hasChilds) {
				var advance = $("<div class='m_gantt-advance'></div>") ;
				bar.append(advance) ;
				var p = 100*task.nbUnitsMade/task.nbUnitsToBeMade ;
				if (p>=opts.thresholdWarning && p<opts.thresholdDanger) advance.addClass('warning') ;
				else if (p>=opts.thresholdDanger && p<100) advance.addClass('danger') ;
				else if (p>100) {
					if (opts.advancesNotOverflow) p = 100 ;
					advance.addClass('danger') ;
				}
				advance.width(p+"%") ;
			}
			if (task.hasChilds) {
				bar.append($("<div class='m_gantt-group-arrow-left'></div>")) ;
				bar.append($("<div class='m_gantt-group-arrow-right'></div>")) ;
			} else {
				bar.append($("<div class='m_gantt-resize'></div>")) ;
			}
			bar.data("id", task.id) ;
			var diff1 = moment(task.end).startOf('day').diff(moment(task.start).startOf('day'), 'days') ;
			var diff2 = moment(task.start).startOf('day').diff(start, 'days') ;
			// var w = grid.width*diff1 ;
			// bar.width(grid.width*diff1) ; //.height(grid.barHeight) ;
			// if (bar.hasChilds) bar.width(grid.width*diff1+40) ;
			gridjEl.append(bar) ;
			bar.css('top', nbBars*grid.height+((grid.height-grid.barHeight)/2))
			   .css('left', grid.width*diff2)
			   .width(grid.width*diff1) ;
			if (task.hasChilds) {
				var wArrow2 = parseInt(bar.find('.m_gantt-group-arrow-left').css('border-left-width'),10) ;
				bar.width(grid.width*diff1+(wArrow2*2)).css('left', grid.width*diff2-wArrow2) ;
				// log("has")
			}
			if (task.bgColor) bar.css('background-color', task.bgColor) ;
			if (!task.hasChilds) {
				bar.mousedown(function(evt) {
					evt.preventDefault();
					currentMouseEvtType = 'click' ;
					var bar = $(evt.target).closest(".m_gantt-task") ;
					_jElToMove = bar ;
					_deltaX = evt.pageX-bar.offset().left ;
					evt.stopPropagation() ;
					$(document).on('mouseup', mouseup) ;
					$(document).on('mousemove', mousemove) ;
				}) ;
				bar.find('.m_gantt-resize').mousedown(function(evt) {
					var resize = $(evt.target).closest(".m_gantt-resize") ;
					var bar = resize.closest(".m_gantt-task") ;
					evt.preventDefault() ;
					evt.stopPropagation() ;
					_jElToMove = bar ;
					_deltaX = evt.pageX-resize.offset().left ;
					$(document).on('mouseup', mouseupresize) ;
					$(document).on('mousemove', mousemoveresize) ;
				}) ;
			}
			tabBars[tasks[i].id] = bar ;
			nbBars++ ;
		}

		mainDiv.find('.m_gantt-grid').width(grid.width*nbDays).height(nbBars*grid.height) ;
		drawLinks() ;






		nbBars = 0 ;
		var ressourcesjEl = mainDiv.find('.m_gantt-ressources').data("opts", grid) ;
		var topRessources = ressourcesjEl.offset().top - mainDiv.find(".m_gantt-relative").offset().top ;
		for(i = 0 ; i<ressources.length ; i++) {
			var ressource = ressources[i] ;
			// var ressourcejEl = $("<div class='m_gantt-ressource'></div>") ;
			// ressourcejEl.data("ressource", ressource.id) ;
			// log("project.end",project.start,project.end)
			// var diffP1 = moment(project.end).startOf('day').diff(moment(project.start).startOf('day'), 'days') ;
			// var diffP2 = moment(project.start).startOf('day').diff(start, 'days') ;
			// projectjEl.width(grid.width*diffP1).height(grid.barHeight) ;
			// ressourcesjEl.append(ressourcejEl) ;
			var ressourcejEL = $("<div class='m_gantt-ressource-name'>"+ressource.name+"</div>") ;
			mainDiv.find(".m_gantt-relative").append(ressourcejEL) ;
			ressourcejEL.css('top', nbBars*grid.height+topRessources) ;

			for(var dateWorked in ressource.work) {
				var jElWork = $("<div class='m_gantt-work'></div>") ;
				var pWorkedThisDay = ressource.daysWorked[moment(dateWorked).day()] ;
				var pWork = ressource.work[dateWorked] ;
				var hWork = pWork*grid.height/pWorkedThisDay ;
				if (pWork>pWorkedThisDay) {
					hWork = grid.height ;
					jElWork.addClass('danger') ;
				}
				jElWork	.css('top', nbBars*grid.height)
						.css('left', getPositionOfDate(moment(dateWorked)))
						.height(hWork)
						;
				ressourcesjEl.append(jElWork) ;
			}
			//    .css('left', grid.width*diffP2) ;
			nbBars++ ;
		}
		mainDiv.find('.m_gantt-ressources').css('background-position', grid.width*(1-start.day())+'px 0').width(grid.width*nbDays).height(nbBars*grid.height) ;







		if (opts.afterRender) opts.afterRender({tasks:tasks, projects:projects, ressources:ressources}) ;
	}
	function getParents(i2, res) {
		if (!res) res = [] ;
		if (tasks[i2].parent && tasks[i2].parent!=='') {
			var ind = getIndexTask(tasks[i2].parent) ;
			res.push(ind) ;
			if (ind>=0) {
				return getParents(ind, res) ;
			}
		}
		return res ;
	}
	function getPositionOfDate(date) {
		// var diffP1 = date.diff(opts.start, 'days') ;
		return grid.width*date.diff(opts.start, 'days') ;
	}
	function getDateFromOffset(left) {
		var leftGrid = gridjEl.offset().left ;
		var diff = left - leftGrid ;
		var nbCols = Math.round(diff / grid.width) ;
		return moment(opts.start).add(nbCols, 'days').startOf('day') ;
	}
	function mouseup(evt) {
		$(document).off('mouseup', mouseup) ;
		$(document).off('mousemove', mousemove) ;
		if (currentMouseEvtType=='move') render() ;
		else {
			var ind = getIndexTask(_jElToMove.data("id")) ;
			if (tasks[ind].click) tasks[ind].click() ;
		}
	}
	function mousemove(evt) {
		currentMouseEvtType = 'move' ;
		var bar = _jElToMove ;
		var left = evt.pageX-_deltaX ;
		var leftGrid = gridjEl.offset().left ;
		var diff = left - leftGrid ;
		left = left - diff % grid.width ;
		bar.offset({left:left}) ;
		if (movePreviousLeft!=left) {
			drawLinks() ;
			var ind = getIndexTask(bar.data("id"))  ;
			tasks[ind].start = getDateFromOffset(left) ;
			tasks[ind].end = moment(tasks[ind].start).add(tasks[ind].diff, 'days') ;
		}
		movePreviousLeft = left ;
	}
	function mouseupresize(evt) {
		$(document).off('mouseup', mouseupresize) ;
		$(document).off('mousemove', mousemoveresize) ;
		render() ;
	}
	function mousemoveresize(evt) {
		var bar = _jElToMove ;
		var left = evt.pageX-_deltaX ;
		var leftBar = bar.offset().left ;
		var diff = left - leftBar ;
		diff = diff - diff % grid.width + grid.width ;
		bar.width(diff) ;
		if (movePreviousLeft!=diff) {
			var ind = getIndexTask(bar.data("id"))  ;
			tasks[ind].diff = Math.round(diff / grid.width) ;
			tasks[ind].end = moment(tasks[ind].start).add(tasks[ind].diff, 'days') ;
			drawLinks() ;
		}
		movePreviousLeft = diff ;
	}
	function drawLinks() {
		gridjEl.find('.m_gantt-link').remove() ;
		for(var i=0 ; i<tasks.length ; i++) {
			var task = tasks[i] ;
			if (task.links) {
				var div2Link = tabBars[task.id] ;
				if (tabBars[task.links]) {
					var div2 = tabBars[task.links] ;
					// log("div",div2Link, div2, task.links, tabBars)

					var l = div2Link.position().left+div2Link.width() ;
					var t = div2Link.position().top+10 ;
					var w = div2.position().left-div2Link.position().left-div2Link.width() ;
					var h = div2.position().top-div2Link.position().top ;
					var startXP = 0 ;
					var pcx1 = Math.ceil((w/3)*2) ;
					var pcx2 = 0 ; //Math.ceil(w-(w/2)) ;
					var endXP = w ;
					
					if (w<20) {
						l = div2.position().left - 40 ;
						w = -1*w + 80 ;
						startXP = w-40 ;
						pcx1 = w ;
						pcx2 = 0 ;
						endXP = 40 ;
					}
					var invertMatrix = false ;
					if (h<0) {
						t = div2.position().top+10 ;
						h = -1*h ;
						invertMatrix = true ;
					}

					var el = $("<div class='m_gantt-link'><canvas width='"+w+"' height='"+(h+5)+"'></canvas></div>") ;
					gridjEl.append(el) ;
					el.css("left",l).css("top",t) ;
					el.width(w).height(h+5) ;
					var ctx = el.find('canvas').get(0).getContext('2d');
					// ctx.scale(2,2);
					if (invertMatrix) {
						ctx.setTransform(1,0,0,-1,0,h) ;
					}
					ctx.fillStyle   = '#000';
					ctx.strokeStyle = '#000';
					ctx.lineWidth   = 2 ;
					ctx.beginPath();
					ctx.moveTo(startXP,1);
					ctx.bezierCurveTo(pcx1,0,pcx2,h,endXP,h);
					ctx.stroke();
					ctx.beginPath();
					ctx.moveTo(endXP,h);
					ctx.lineTo(endXP-5, h-5);
					ctx.lineTo(endXP-5, h+5);
					ctx.fill();
					// log(l,t,w,h, startXP, endXP, pcx1, pcx2)
				}
			}
		}		
	}
	function sayHello() {
		element.append($("<div>Hello</div>")) ;
	}
	function addTask(data) {
		tasks.push(data) ;
		render() ;
	}
	function getTask(id) {
		for(var i=0 ; i<tasks.length ; i++) {
			if (tasks[i].id==id) {
				return tasks[i] ;
			}
		}
		return null ;
	}
	function getIndexTask(id) {
		for(var i=0 ; i<tasks.length ; i++) {
			if (tasks[i].id==id) {
				return i ;
			}
		}
		return -1 ;
	}
	function getIndexProject(id) {
		for(var i=0 ; i<projects.length ; i++) {
			if (projects[i].id==id) {
				return i ;
			}
		}
		return -1 ;
	}
	function getIndexRessource(id) {
		for(var i=0 ; i<ressources.length ; i++) {
			if (ressources[i].id==id) {
				return i ;
			}
		}
		return -1 ;
	}
	function removeTask(idToRemove) {
		for(var i=0 ; i<tasks.length ; i++) {
			if (tasks[i].id==idToRemove) {
				tasks.splice(i,1) ;
				break ;
			}
		}
		render() ;
	}

}

// mg._startDrag = false ;


;;

});






