# vehicle-server
Local node.js server for electric vehicle.

# Add serverCfg.js to project root directory

//serverCfg.js  
module.exports = {  
    &nbsp;&nbsp;api: {  
        &nbsp;&nbsp;&nbsp;&nbsp;weather: 'INSERT_YOUR_KEY', //OpenWeatherMap  
        &nbsp;&nbsp;&nbsp;&nbsp;maps: 'INSERT_YOUR_KEY' //Google maps JavaScript API  
    &nbsp;&nbsp;},  
    &nbsp;&nbsp;port: {  
        &nbsp;&nbsp;&nbsp;&nbsp;controllerPort_1: '/dev/controller.1',  
        &nbsp;&nbsp;&nbsp;&nbsp;controllerPort_2: '/dev/controller.2',  
        &nbsp;&nbsp;&nbsp;&nbsp;driverPort: '/dev/driver.1'  
    &nbsp;&nbsp;},  
    &nbsp;&nbsp;address: {  
        &nbsp;&nbsp;&nbsp;&nbsp;remoteAddress: '192.168.2.56'  
    &nbsp;&nbsp;}  
}
