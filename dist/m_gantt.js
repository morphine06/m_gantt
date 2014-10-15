/*!
 * m_gantt v0.1.1
 * Docs & License: http://????
 * (c) 2014 David Miglior (3doubleV)
 */

function log() {
	if (window.console) {
		console.log.apply(window.console, arguments) ;
	}
}


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
	grid: {
		width: 32,
		height: 32,
		img: 'm_gantt-bg.gif', // relative to css
		// heightHeaderLine: 20,
		barHeight: 20
	}
} ;


var mg = $.m_gantt = { version: "0.1.1" };


$.fn.m_gantt = function(options) {
	var args = Array.prototype.slice.call(arguments, 1);
	var res = this;
	this.each(function(i, _element) {
		var element = $(_element);
		var gantt = element.data('m_gantt'); 
		var singleRes; 
		// log("options",options)
		if (typeof options === 'string') {
			log(gantt, $.isFunction(gantt[options]))
			if (gantt && $.isFunction(gantt[options])) {
				singleRes = gantt[options].apply(gantt, args);
				if (!i) {
					res = singleRes; 
				}
				if (options === 'destroy') {
					element.removeData('gantt');
				}
			}
		}
		// a new calendar initialization
		else if (!gantt) { // don't initialize twice
			gantt = new m_gantt(element, options);
			element.data('m_gantt', gantt);
			gantt.render();
		}
	});
	return res;
};



function m_gantt(element, instanceOptions) {
	var me = this;

	var opts = $.extend(true, {}, defaults, instanceOptions) ;

	// Exports
	me.render = render ;
	me.sayHello = sayHello ;
	me.addTask = addTask ;
	me.removeTask = removeTask ;
	me.opts = opts ;

	// local variables 
	var values = opts.values ;
	var tabBars = {} ;
	var grid = null ;
	var _jElToMove = null ;
	var _deltaX = 0 ;
	var movePreviousLeft = -1 ;
	var rendered = false ;
	var mainDiv = null ;

	function firstRender() {
		mainDiv = $("<div class='m_gantt'><div class='m_gantt-col-labels'></div><div class='m_gantt-col-center'><div class='m_gantt-grid-header'></div><div class='m_gantt-grid'></div></div><div class='m_gantt-col-sums'></div></div>") ;
		element.append(mainDiv) ;
		rendered = true ;
	}
	function render() {
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
			// log("endMinusOne",endMinusOne.format("YYYY-MM-DD HH:mm:ss"))
			if (d.format('D')*1==d.daysInMonth() || d.isSame(endMinusOne)) {
				// log("d",d.format('D'),d.daysInMonth(), d.isSame(start), d.isSame(endMinusOne))
				// log(d)
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

		for(var i=0 ; i<values.length ; i++) {
			var v = values[i] ;
			v.id = v.id || ('bar'+i) ;
			v.text = v.text || "" ;
			// log(v.text)
			var bar = $("<div class='m_gantt-bar'><div class='m_gantt-resize'></div>"+v.text+"</div>") ;
			if (v.data) bar.data("data", v.data) ;
			var diff1 = moment(v.end).startOf('day').diff(moment(v.start).startOf('day'), 'days') ;
			var diff2 = moment(v.start).startOf('day').diff(start, 'days') ;
			// log("diff2",diff2)
			bar.width(opts.grid.width*diff1).height(opts.grid.barHeight) ;
			grid.append(bar) ;
			bar.css('top', i*opts.grid.height+((opts.grid.height-opts.grid.barHeight)/2))
			   .css('left', opts.grid.width*diff2) ;
			if (v.bgColor) bar.css('background-color', v.bgColor) ;
			bar.mousedown(function(evt) {
				var bar = $(evt.target).closest(".m_gantt-bar") ;
				evt.preventDefault();
				evt.stopPropagation() ;
				_jElToMove = bar ;
				_deltaX = evt.pageX-bar.offset().left ;
				$(document).on('mouseup', mouseup) ;
				$(document).on('mousemove', mousemove) ;
			}) ;
			bar.find('.m_gantt-resize').mousedown(function(evt) {
				var resize = $(evt.target).closest(".m_gantt-resize") ;
				var bar = resize.closest(".m_gantt-bar") ;
				evt.preventDefault() ;
				evt.stopPropagation() ;
				_jElToMove = bar ;
				_deltaX = evt.pageX-resize.offset().left ;
				$(document).on('mouseup', mouseupresize) ;
				$(document).on('mousemove', mousemoveresize) ;
			}) ;
			tabBars[values[i].id] = bar ;
		}
		drawLinks() ;

	}
	function mouseup(evt) {
		$(document).off('mouseup', mouseup) ;
		$(document).off('mousemove', mousemove) ;
		drawLinks() ;
	}
	function mousemove(evt) {
		var bar = _jElToMove ;
		var left = evt.pageX-_deltaX ;
		var leftGrid = grid.offset().left ;
		var diff = left - leftGrid ;
		left = left - diff % 32 ;
		bar.offset({left:left}) ;
		if (movePreviousLeft!=left) drawLinks() ;
		movePreviousLeft = left ;
	}
	function mouseupresize(evt) {
		$(document).off('mouseup', mouseupresize) ;
		$(document).off('mousemove', mousemoveresize) ;
		drawLinks() ;
	}
	function mousemoveresize(evt) {
		var bar = _jElToMove ;
		var left = evt.pageX-_deltaX ;
		// var leftGrid = grid.offset().left ;
		var leftBar = bar.offset().left ;
		var diff = left - leftBar ;
		diff = diff - diff % 32 + 32 ;
		bar.width(diff) ;
		// left = left - diff % 32 ;
		// bar.offset({left:left}) ;
		if (movePreviousLeft!=diff) drawLinks() ;
		movePreviousLeft = diff ;
	}
	function drawLinks() {
		log("drawLinks")
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
	function removeTask(idToRemove) {
		for(var i=0 ; i<values.length ; i++) {
			log("values[i].id",values[i].id)
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






