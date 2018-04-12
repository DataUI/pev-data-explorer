// Code from GEOG575 Lab 2
// uses standard.js style guide, linter, and formatter
// https://standardjs.com/

(function (window, d3, $) {
  // Titles and labels for data attributes
  const attrDict = {
    'num_stations': {
      optionLabel: 'Charging Stations',
      title: 'Number of Stations',
      description: 'The map and chart summarize the total number of charging stations (private and public) in each state.'
    },
    'num_outlets': {
      optionLabel: 'Charging Outlets',
      title: 'Number of Charging Outlets',
      description: 'The map and chart summarize the total number of charging outlets available in each state.'
    },
    'laws': {
      optionLabel: 'Laws and Incentives',
      title: 'Number of Laws and Incentives',
      description: 'The map and chart summarize the total number of clean transportation laws, regulations, and funding opportunities for electric vehicles in each state.'
    },
    'sales_2016': {
      optionLabel: 'Vehicle Registrations',
      title: 'Vehicle Registrations',
      description: 'The map and chart summarize the total number of electric vehicle registrations in each state (year 2016).'
    },
    '2016_vehicles_per_capita': {
      optionLabel: 'Vehicles per capita',
      title: 'Vehicles Per Capita',
      description: 'The map and chart summarize the PEV Registrations per 1,000 People by state (year 2016).'
    }
  }

  // Array of attribute keys
  const attrArray = Object.keys(attrDict)

  // Default attribute value
  let expressed = attrArray[0]

  // chart frame dimensions
  // var chartWidth = window.innerWidth * 0.425
  let chartWidth = $('#map').parent().width() * 1.425
  let chartHeight = 410
  let leftPadding = 40
  let rightPadding = 2
  let topBottomPadding = 5
  let chartInnerWidth = chartWidth - leftPadding - rightPadding

  let translate = 'translate(' + leftPadding + ',' + topBottomPadding + ')'

  // Set domain and range for y-aaxis
  let yScale = d3.scaleLinear()
    .range([400, 0])
    .domain([0, 5000])

  // Begin script when window loads
  window.onload = setMap()

  // Set up choropleth map
  function setMap () {
    // map frame dimensions
    let mapWidth = $('#map').parent().width()
    let height = 460

    // create new svg container for the map
    let map = d3.select('#map')
      .append('svg')
      .attr('class', 'map')
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('viewBox', '0 0 ' + mapWidth + ' ' + height)
      .classed('svg-content', true)

    // create Albers equal area conic projection centered on the United States
    let projection = d3.geoAlbersUsa()
      .scale(983)
      .translate([mapWidth / 2, height / 2]) // Keep these as one-half the <svg> width and height to keep your map centered in the container

    let path = d3.geoPath().projection(projection)

    // Get data from CSV and JSON files
    d3.queue()
      .defer(d3.csv, 'data/ev-states.csv') // load data attributes from csv
      .defer(d3.json, 'data/states.topojson') // load choropleth spatial data
      .await(processData)

    function processData (error, csvData, us) {
      let states = topojson.feature(us, us.objects.states).features // convert the data back to geojson

      // join csv data to GeoJSON enumeration units
      states = joinData(states, csvData)

      // create the color scale
      let colorScale = makeColorScale(csvData)

      // add enumeration units to the map
      setEnumerationUnits(states, map, path, colorScale)

      // add coordinated visualization to the map
      setChart(csvData, colorScale)

      // add the dropdown menu to the map
      createDropdown(csvData)

      // Append tooltip div
      let div = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
    }
  }; // end of setMap

  function joinData (states, csvData) {
    // variables for data join

    // loop through csv to assign each set of csv attribute values to geojson region
    for (let i = 0; i < csvData.length; i++) {
      let csvState = csvData[i] // the current us state
      let csvKey = csvState.state_abbr // the CSV primary key

      // loop through geojson regions to find correct region
      for (let a = 0; a < states.length; a++) {
        let geojsonProps = states[a].properties // the current region geojson properties
        let geojsonKey = geojsonProps.state_abbr // the geojson primary key
        // where primary keys match, transfer csv data to geojson properties object
        if (geojsonKey == csvKey) {
          // assign all attributes and values
          attrArray.forEach(function (attr) {
            let val = parseFloat(csvState[attr]) // get csv attribute value
            geojsonProps[attr] = val // assign attribute and value to geojson properties
          })
        };
      };
    };
    return states
  };

  function setEnumerationUnits (states, map, path, colorScale) {
    // add States to the map
    let addstates = map.selectAll('.addstates')
      .data(states)
      .enter()
      .append('path')
      .attr('class', function (d) {
        // return ".addstates"
        return 'addstates ' + d.properties.state_abbr
      })
      .attr('d', path)
      .style('fill', function (d) {
        return choropleth(d.properties, colorScale)
      })

      .on('mouseover', function (d) {
        highlight(d.properties)
      })
      .on('mouseout', function (d) {
        dehighlight(d.properties)
      })
      .on('mousemove', moveLabel)

    let desc = addstates.append('desc')
      .text('{"stroke": "#000", "stroke-width": "0.5px"}')
  };

  // Example 1.4 line 11...function to create color scale generator
  function makeColorScale (data) {
    let colorClasses = [
      '#f1eef6',
      '#bdc9e1',
      '#74a9cf',
      '#2b8cbe',
      '#045a8d'
    ]

    // create color scale generator
    let colorScale = d3.scaleQuantile()
      .range(colorClasses)

    // build array of all values of the expressed attribute
    let domainArray = []
    for (let i = 0; i < data.length; i++) {
      let val = parseFloat(data[i][expressed])
      domainArray.push(val)
    };

    // assign array of expressed values as scale domain
    colorScale.domain(domainArray)

    return colorScale
  };

  // function to test for data value and return color
  function choropleth (props, colorScale) {
    // make sure attribute value is a number
    let val = parseFloat(props[expressed])

    // if attribute value exists, assign a color; otherwise assign gray
    if (typeof val === 'number' && !isNaN(val)) {
      return colorScale(val)
    } else {
      return '#CCC'
    };
  };

  // function to create coordinated bar chart
  function setChart (csvData, colorScale) {
    // create a second svg element to hold the bar chart
    let chart = d3.select('#chart')
      .append('svg')
      // .attr('width', chartWidth)
      // .attr('height', chartHeight)
      .attr('class', 'chart')
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('viewBox', '0 0 ' + chartWidth + ' ' + chartHeight)
      .classed('svg-content', true)

    // set bars for each province
    let bars = chart.selectAll('.bar')
      .data(csvData)
      .enter()
      .append('rect')
      .sort(function (a, b) {
        return b[expressed] - a[expressed]
      })
      .attr('class', function (d) {
        return 'bar ' + d.state_abbr
      })
      .attr('width', chartInnerWidth / csvData.length - 1)
      .on('mouseover', highlightChart)
      .on('mouseout', dehighlight)
      .on('mousemove', moveLabel)

    let desc = bars.append('desc')
      .text('{"stroke": "none", "stroke-width": "0px"}')

    // create vertical axis generator
    let yAxis = d3.axisLeft()
      .scale(yScale)
      .tickFormat(d3.format('s'))
    // .orient("left");

    // place axis
    let axis = chart.append('g')
      .attr('class', 'axis')
      .attr('transform', translate)
      .call(yAxis)

    // set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale)
  };

  // function to create a dropdown menu for attribute selection
  function createDropdown (csvData) {
    // add select element
    let dropdown = d3.select('.sel-attr')
      .append('select')
      .attr('id', 'sel-attr')
      .attr('class', 'form-control')
      .on('change', function () {
        changeAttribute(this.value, csvData)
      })

    // add initial option
    let titleOption = dropdown.append('option')
      .attr('class', 'titleOption')
      .attr('disabled', 'true')
      .text('Select Attribute')

    // add attribute name options
    let attrOptions = dropdown.selectAll('attrOptions')
      .data(attrArray)
      .enter()
      .append('option')
      .attr('value', function (d) { return d })
      .property('selected', function (d) { return d === 'num_stations' })
      .text(function (d) {
        return attrDict[d].optionLabel
      })
  };

  // dropdown change listener handler
  function changeAttribute (attribute, csvData) {
    // change the expressed attribute
    expressed = attribute

    // Get the max value for the selected attribute
    let max = d3.max(csvData, function (d) {
      return +d[expressed]
    })

    // set reset yScale
    yScale = d3.scaleLinear()
      .range([chartHeight - 10, 0])
      .domain([0, max])

    // recreate the color scale
    let colorScale = makeColorScale(csvData)

    // recolor enumeration units
    let addstates = d3.selectAll('.addstates')
      .transition()
      .duration(1000)
      .style('fill', function (d) {
        return choropleth(d.properties, colorScale)
      })

    // re-sort, resize, and recolor bars
    let bars = d3.selectAll('.bar')
      .sort(function (a, b) { // re-sort bars
        return b[expressed] - a[expressed]
      })
      .transition() // add animation
      .delay(function (d, i) {
        return i * 20
      })
      .duration(500)
      .attr('x', function (d, i) {
        return i * (chartInnerWidth / csvData.length) + leftPadding
      })
      .attr('height', function (d, i) { // resize bars
        return 400 - yScale(parseFloat(d[expressed]))
      })
      .attr('y', function (d, i) {
        return yScale(parseFloat(d[expressed])) + topBottomPadding
      })

      .style('fill', function (d) { // recolor bars
        return choropleth(d, colorScale)
      })

    updateChart(bars, csvData.length, colorScale)
  };

  // Update chart position, size, and bar color
  function updateChart (bars, n, colorScale) {
    bars.attr('x', function (d, i) { // position bars
      return i * (chartInnerWidth / n) + leftPadding
    })
      .attr('height', function (d, i) { // size/resize bars
        return 400 - yScale(parseFloat(d[expressed]))
      })
      .attr('y', function (d, i) {
        return yScale(parseFloat(d[expressed])) + topBottomPadding
      })

      .style('fill', function (d) { // color/recolor bars
        return choropleth(d, colorScale)
      })

    // add title to chart based on array value
    let chartTitle = attrDict[expressed].title

    // d3.select('.chartTitle').text(chartTitle)
    $('#map-title').text(chartTitle)
    $('#attr-desc').text(attrDict[expressed].description)

    // Format y-axis
    let yAxis = d3.axisLeft()
      .scale(yScale)
      .tickFormat(function (d) { // display unit abbreviations for large numbers
        let array = ['', 'K', 'M', 'G', 'T', 'P']

        let i = 0

        while (d >= 1000) {
          i++
          d = d / 1000
        }

        d = d + array[i]

        return d
      })

    // update the charts axis
    d3.selectAll('g.axis')
      .call(yAxis)
  };

  // function to highlight enumeration units and bars
  function highlight (props) {
    // change stroke
    let selected = d3.selectAll('.' + props.state_abbr)
      .style('stroke', 'yellow')
      .style('stroke-width', '2.5')

    setLabel(props)
  };

  function highlightChart (props) {
    let selected = d3.selectAll('.' + props.state_abbr)
      .style('stroke', 'yellow')
      .style('stroke-width', '2.5')

    let labelAttribute = '<span class="h1">' + formatNumCommas(props[expressed]) + '</span><p>' + attrDict[expressed].title + '</p>' + props.state_name

    $('#chart-info').show().html(labelAttribute)
  }

  // function to reset the element style on mouseout
  function dehighlight (props) {
    $('#chart-info').hide()

    let selected = d3.selectAll('.' + props.state_abbr)
      .style('stroke', function () {
        return getStyle(this, 'stroke')
      })
      .style('stroke-width', function () {
        return getStyle(this, 'stroke-width')
      })

    function getStyle (element, styleName) {
      let styleText = d3.select(element)
        .select('desc')
        .text()

      let styleObject = JSON.parse(styleText)

      return styleObject[styleName]
    };

    // remove the info label
    d3.select('.infolabel')
      .remove()
  };

  function formatNumCommas (x) {
    // Format number with commas
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  };

  // function to create dynamic label
  function setLabel (props) {
    // let labelAttribute = attrDict[expressed].title
    let labelAttribute = '<span class="h1">' + formatNumCommas(props[expressed]) + '</span><p>' + attrDict[expressed].title + '</p>'

    // Create tooltip content
    let infolabel = d3.select('body')
      .append('div')
      .attr('class', 'infolabel')
      // .attr('FID', props.state_abbr + '_label')
      .html(labelAttribute)

    let stateName = infolabel.append('div')
      .attr('class', 'labelname')
      .html(props.state_name)
  };

  // function to move info label with mouse
  function moveLabel () {
    // Move tooltip only when it is displayed
    if (d3.select('.infolabel').node() === null) {
      return
    }

    // get width of label
    let labelWidth = d3.select('.infolabel')
      .node()
      .getBoundingClientRect()
      .width

    // use coordinates of mousemove event to set label coordinates
    let x1 = d3.event.clientX + 10,
      y1 = d3.event.clientY - 100,
      x2 = d3.event.clientX - labelWidth - 10,
      y2 = d3.event.clientY + 25

    // horizontal label coordinate, testing for overflow
    let x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1
    // vertical label coordinate, testing for overflow
    let y = d3.event.clientY < 100 ? y2 : y1

    d3.select('.infolabel')
      .style('left', x + 'px')
      .style('top', y + 'px')
  };
})(window, d3, jQuery)
