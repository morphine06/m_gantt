/*!
 * m_gantt v0.1.1
 * Docs & License: http://????
 * (c) 2014 David Miglior (3doubleV)
 */



(function(factory) {
	if (typeof define === 'function' && define.amd) {
		define([ 'jquery', 'moment' ], factory);
	}
	else {
		factory(jQuery, moment);
	}
})(function($, moment) {

;;

var defaults = {
	lang: 'en',
	aspectRatio: 0.8,
	labelsWidth: 0,
	firstDay: 1,
	start: moment(),
	end: moment().add(3, 'months'),
	values: [],
	thresholdWarning: 70,
	thresholdDanger: 90,
	advancesNotOverflow: false,

	// beforeRender: function() {},
	// afterRender: function() {},
	// clickTask: function() {},


	grid: {
		width: 32,
		height: 32,
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

	// Exports
	me.render = render ;
	me.sayHello = sayHello ;
	me.addTask = addTask ;
	me.removeTask = removeTask ;
	me.getTask = getTask ;
	me.getIndexTask = getIndexTask ;
	me.opts = opts ;

	// local variables 
	var values = opts.values ;
	var tabBars = {} ;
	var grid = null ;
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

	// the first render, create all main divs
	function firstRender() {
		mainDiv = $("<div class='m_gantt'><div class='m_gantt-col-labels'></div><div class='m_gantt-col-center'><div class='m_gantt-grid-header'></div><div class='m_gantt-grid'></div></div><div class='m_gantt-col-sums'></div></div>") ;
		element.append(mainDiv) ;
		// and set rendered = true
		rendered = true ;
	}

	function uniformizeValues() {
		for(var i=0 ; i<values.length ; i++) {
			values[i].id = values[i].id || ('bar'+i) ;
			values[i].text = values[i].text || "" ;
			values[i].hasChilds = false ;
			// values[i].start = moment(values[i].start) ;
			// values[i].end = moment(values[i].end) ;
			values[i].start = (moment.isMoment(values[i].start))?values[i].start:moment(values[i].start) ;
			values[i].end = (moment.isMoment(values[i].end))?values[i].end:moment(values[i].end) ;
			values[i].diff = values[i].end.diff(values[i].start, 'days') ;
			// log("values[i].diff",values[i].diff)
			if (values[i].parent) {
				for(var j=0 ; j<values.length ; j++) {
					if (values[j].id==values[i].parent) {
						if (!values[j].hasChilds) {
							values[j].start = moment(values[i].start) ;
							values[j].end = moment(values[i].end) ;
							values[j].hasChilds = true ;
						} else {
							values[j].start = moment(moment.min(values[j].start, values[i].start)) ;
							values[j].end = moment(moment.max(values[j].end, values[i].end)) ;
						}
						break ;
					}
				}
			}
		}
	}

	// draw the tasks
	function render() {
		if (opts.beforeRender && opts.beforeRender()===false) return ;
		if (!rendered) firstRender() ;

		mainDiv.find(".m_gantt-col-labels").empty() ;
		mainDiv.find(".m_gantt-grid-header").empty() ;
		mainDiv.find(".m_gantt-grid").empty() ;
		mainDiv.find(".m_gantt-col-sums").empty() ;

		var h = 0 ;
		if (opts.height && opts.height!='auto' && opts.height>0) h = opts.height ;
		else h = mainDiv.width()*opts.aspectRatio ;
		mainDiv.height(h) ;
		mainDiv.find('.m_gantt-col-labels').width(opts.labelsWidth) ;
		mainDiv.find('.m_gantt-col-center').width(mainDiv.width() - (mainDiv.find('.m_gantt-col-labels').width() + mainDiv.find('.m_gantt-col-sums').width())) ;

		var start = moment(opts.start).startOf('day'),
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
		mainDiv.find('.m_gantt-grid-header').append("<table><tr class='m_gantt-grid-header-dayofweek'>"+html1+"</tr><tr class='m_gantt-grid-header-day'>"+html2+"</tr><tr class='m_gantt-grid-header-month'>"+html3+"</td></tr></table>").width(opts.grid.width*nbDays) ;
		mainDiv.find('.m_gantt-grid-header table').width(opts.grid.width*nbDays) ;
		mainDiv.find('.m_gantt-grid-header table').width(opts.grid.width*nbDays) ;
		mainDiv.find('.m_gantt-grid').width(opts.grid.width*nbDays).height(values.length*opts.grid.height) ;

		grid = mainDiv.find('.m_gantt-grid').data("opts", opts.grid) ;

		// set hasChilds and recalculate date of parents
		uniformizeValues() ;
		// log("values",values)

		for(var i=0 ; i<values.length ; i++) {
			var v = values[i] ;
			var cls = 'm_gantt-task' ;
			if (v.hasChilds) cls = 'm_gantt-group' ;
			var bar = $("<div class='"+cls+"'>"+v.text+"</div>") ;
			if (v.nbUnitsToBeMade && v.nbUnitsMade) {
				var advance = $("<div class='m_gantt-advance'></div>") ;
				bar.append(advance) ;
				var p = 100*v.nbUnitsMade/v.nbUnitsToBeMade ;
				if (p>=opts.thresholdWarning && p<opts.thresholdDanger) advance.addClass('warning') ;
				else if (p>=opts.thresholdDanger && p<100) advance.addClass('danger') ;
				else if (p>100) {
					if (opts.advancesNotOverflow) p = 100 ;
					advance.addClass('danger') ;
				}
				advance.width(p+"%") ;
			}
			if (!v.hasChilds) {
				bar.append($("<div class='m_gantt-resize'></div>")) ;
			} else {
				bar.append($("<div class='m_gantt-arrow-left'></div>")) ;
				bar.append($("<div class='m_gantt-arrow-right'></div>")) ;
			}
			bar.data("id", v.id) ;
			var diff1 = moment(v.end).startOf('day').diff(moment(v.start).startOf('day'), 'days') ;
			var diff2 = moment(v.start).startOf('day').diff(start, 'days') ;
			// log("diff2",diff2)
			bar.width(opts.grid.width*diff1).height(opts.grid.barHeight) ;
			grid.append(bar) ;
			bar.css('top', i*opts.grid.height+((opts.grid.height-opts.grid.barHeight)/2))
			   .css('left', opts.grid.width*diff2) ;
			if (v.bgColor) bar.css('background-color', v.bgColor) ;
			if (!v.hasChilds) {
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
			tabBars[values[i].id] = bar ;
		}
		drawLinks() ;
		if (opts.afterRender) opts.afterRender(values) ;
	}
	function getDateFromOffset(left) {
		var leftGrid = grid.offset().left ;
		var diff = left - leftGrid ;
		var nbCols = Math.round(diff / 32) ;
		return moment(opts.start).add(nbCols, 'days').startOf('day') ;
	}
	function mouseup(evt) {
		$(document).off('mouseup', mouseup) ;
		$(document).off('mousemove', mousemove) ;
		if (currentMouseEvtType=='move') render() ;
		else {
			var ind = getIndexTask(_jElToMove.data("id")) ;
			if (values[ind].click) values[ind].click() ;
		}
	}
	function mousemove(evt) {
		currentMouseEvtType = 'move' ;
		var bar = _jElToMove ;
		var left = evt.pageX-_deltaX ;
		var leftGrid = grid.offset().left ;
		var diff = left - leftGrid ;
		left = left - diff % 32 ;
		bar.offset({left:left}) ;
		if (movePreviousLeft!=left) {
			drawLinks() ;
			var ind = getIndexTask(bar.data("id"))  ;
			values[ind].start = getDateFromOffset(left) ;
			values[ind].end = moment(values[ind].start).add(values[ind].diff, 'days') ;
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
		diff = diff - diff % 32 + 32 ;
		bar.width(diff) ;
		if (movePreviousLeft!=diff) {
			var ind = getIndexTask(bar.data("id"))  ;
			values[ind].diff = Math.round(diff/32) ;
			values[ind].end = moment(values[ind].start).add(values[ind].diff, 'days') ;
			drawLinks() ;
		}
		movePreviousLeft = diff ;
	}
	function drawLinks() {
		grid.find('.m_gantt-link').remove() ;
		for(var i=0 ; i<values.length ; i++) {
			var v = values[i] ;
			if (v.links) {
				var div2Link = tabBars[v.id] ;
				if (tabBars[v.links]) {
					var div2 = tabBars[v.links] ;
					// log("div",div2Link, div2, v.links, tabBars)

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
					grid.append(el) ;
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
		values.push(data) ;
		render() ;
	}
	function getTask(id) {
		for(var i=0 ; i<values.length ; i++) {
			if (values[i].id==id) {
				return values[i] ;
			}
		}
		return null ;
	}
	function getIndexTask(id) {
		for(var i=0 ; i<values.length ; i++) {
			if (values[i].id==id) {
				return i ;
			}
		}
		return null ;
	}
	function removeTask(idToRemove) {
		for(var i=0 ; i<values.length ; i++) {
			if (values[i].id==idToRemove) {
				values.splice(i,1) ;
				break ;
			}
		}
		render() ;
	}

}

// mg._startDrag = false ;


;;

});






