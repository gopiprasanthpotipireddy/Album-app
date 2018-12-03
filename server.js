var express = require('express'),
    app=express(),
    fs = require('fs'),
    url = require('url'),
    async=require('async'),
    path=require('path');
function load_album_list (callback) {
// we will just assume that any directory in our 'albums'
// subfolder is an album.
fs.readdir(
"albums",
function (err, files) {
if (err) {
callback(make_error("file_error", JSON.stringify(err)));
return;
}
var only_dirs = [];
(function iterator (index) {
if (index == files.length) {
callback(null, only_dirs);
return;
}
fs.stat(
"albums/" + files[index],function (err, stats) {
if (err) {
callback(make_error("file_error",
JSON.stringify(err)));
return;
}
if (stats.isDirectory()) {
var obj = { name: files[index] };
only_dirs.push(obj);
}
iterator(index + 1)
}
);
})(0);
}
);
}
function load_album (album_name,page,page_size,callback) {
// we will just assume that any directory in our 'albums'
// subfolder is an album.
fs.readdir(
"albums/" + album_name,
function (err, files) {
if (err) {
if (err.code == "ENOENT") {
callback(no_such_album());
} else {
callback(make_error("file_error",
JSON.stringify(err)));
}
return;
}
var only_files = [];
var path = "albums/" + album_name + "/";
(function iterator (index) {
if (index == files.length) {
    only_files = only_files.splice(page*page_size,page_size);
var obj = { short_name: album_name,
photos: only_files };
callback(null, obj);
return;
}
fs.stat(
path + files[index],function (err, stats) {
if (err) {
callback(make_error("file_error",
JSON.stringify(err)));
return;
}
if (stats.isFile()) {
var obj = { filename: files[index],
desc: files[index] };
only_files.push(obj);
}
iterator(index + 1)
}
);
})(0);
}
);
}

function handle_rename_album(req,res){
    // 1. Get the album name from the URL
var core_url = req.parsed_url.pathname;
var parts = core_url.split('/');
if (parts.length != 4) {
send_failure(res, 404, invalid_resource(core_url));
return;
}
var album_name = parts[2];
// 2. get the POST data for the request. this will have the JSON
// for the new name for the album.
var json_body = '';
req.on(
'readable' ,
function () {
var d = req.read();
if (d) {
if (typeof d == 'string') {
json_body += d;
} else if (typeof d == 'object' && d instanceof Buffer) {
json_body += d.toString('utf8');
}
}
}
);
    // 3. when we have all the post data, make sure we have valid
// data and then try to do the rename.
req.on(
'end' ,
function () {
// did we get a body?
if (json_body) {
try {
var album_data = JSON.parse(json_body);
if (!album_data.album_name) {
send_failure(res, 403, missing_data('album_name'));
return;
}
} catch (e) {
// got a body, but not valid json
send_failure(res, 403, bad_json());
return;
}
// 4. Perform rename!
do_rename(
album_name,
// old
album_data.album_name, // new
function (err, results) {
if (err && err.code == "ENOENT") {
send_failure(res, 403, no_such_album());
return;
} else if (err) {
send_failure(res, 500, file_error(err));
return;
}
send_success(res, null);
}
);
} else { // didn't get a body
send_failure(res, 403, bad_json());
res.end();
}
}
);
}
app.get( '/albums.json' , handle_list_albums);
app.get( '/albums/:album_name.json' , handle_get_album);
app.get( '/content/:filename' , function (req, res) {
serve_static_file('content/' + req.params.filename, res);
});
app.get( '/templates/:template_name' , function (req, res) {
serve_static_file("templates/" + req.params.template_name, res);
});
app.get( '/pages/:page_name' , serve_page);
app.get( '/pages/:page_name/:sub_page' , serve_page);
app.get( '*' , four_oh_four);
function four_oh_four (req, res) {
send_failure(res, 404, invalid_resource());
}
function serve_static_file(file,res){
    console.log(file);
    fs.exists(file, function (exists) {
if (!exists) {
res.writeHead(404, { "Content-Type" : "application/json" });
var out = { error: "not_found",
message: "'" + file + "' not found" };
res.end(JSON.stringify(out) + "\n");
return;
}
        else console.log("file exists");
    });
    var rs = fs.createReadStream(file);
var ct = content_type_for_file(file);
res.writeHead(200, { "Content-Type" : ct });
rs.on(
'readable',
function () {
   // console.log("in readable");
var d = rs.read();
if (d) {
if (typeof d == 'string')
res.write(d);
else if (typeof d == 'object' && d instanceof Buffer)
       res.write(d.toString('utf8'));
}
}
);
rs.on(
'end' ,
function () {
res.end();
}
);
// we're done!!!
rs.on(
'error' ,
function (e) {
res.writeHead(404, { "Content-Type" : "application/json" });
var out = { error: "not_found",
message: "'" + file + "' not found" };
res.end(JSON.stringify(out) + "\n");
return;
}
);
}
function content_type_for_file (file) {
var ext = path.extname(file);
switch (ext.toLowerCase()) {
case '.html': return "text/html";
case ".js": return "text/javascript";
case ".css": return 'text/css';
case '.jpg': case '.jpeg': return 'image/jpeg';
default: return 'text/plain';
}
}
function handle_list_albums (req, res) {
load_album_list( function (err, albums) {
if (err) {
send_failure(res, 500, err);
return;
}
send_success(res, { albums: albums });
});
}
function handle_get_album (req, res) {
    // get the GET params
//var getp = req.parsed_url.query;
/* var page_num = getp.page ? getp.page : 0;
var page_size = getp.page_size ? getp.page_size : 1000;
if (isNaN(parseInt(page_num))) page_num = 0;
if (isNaN(parseInt(page_size))) page_size = 1000;
// format of request is /albums/album_name.json
    */
//var core_url = req.parsed_url.pathname
    var getp=get_query_params(req);
    console.log(getp.page);
    var page_num=getp.page ? getp.page : 0;
    var page_size=getp.page_size ? getp.page_size : 1000;
    
if (isNaN(parseInt(page_num))) page_num = 0;
if (isNaN(parseInt(page_size))) page_size = 1000;
    var album_name = get_album_name(req);
load_album(
album_name,page_num,page_size,function (err, album_contents) {
if (err && err.error == "no_such_album") {
send_failure(res, 404, err);
} else if (err) {
send_failure(res, 500, err);
} else {
send_success(res, { album_data: album_contents });
}
}
);
}
function get_album_name (req) {
return req.params.album_name;
}
function get_template_name (req) {
return req.params.template_name;
}
function get_query_params (req) {
return req.query;
}
function get_page_name (req) {
return req.params.page_name;
}
function serve_page (req, res) {
    
//var core_url = req.parsed_url.pathname;
var page = get_page_name(req);
    console.log(page.substring(0,6));
// remove /pages/// currently only support home!   http://localhost:8080/pages/albums/farewell
if (page != 'home' && page.substring(0,5) != 'album')   {
    console.log("error");
send_failure(res, 404, invalid_resource());
return;
}
    if(page != 'home')
        page = 'album';
fs.readFile(
'basic.html',
function (err, contents) {
if (err) {
send_failure(res, 500, err);
return;
}
contents = contents.toString('utf8');
// replace page name, and then dump to output.
contents = contents.replace( '{{PAGE_NAME}}' , page);
res.writeHead(200, { "Content-Type": "text/html" });
res.end(contents);
}
);
}
function make_error (err, msg) {
var e = new Error(msg);
e.code = err;
return e;
}
function send_success (res, data) {
res.writeHead(200, {"Content-Type": "application/json"});
var output = { error: null, data: data };
res.end(JSON.stringify(output) + "\n");
}
function send_failure (res, code, err) {
//var code = (err.code) ? err.code : err.name;
res.writeHead(code, { "Content-Type" : "application/json" });
res.end(JSON.stringify({ error: code, message: err.message }) + "\n");
}
function invalid_resource () {
return make_error("invalid_resource",
"the requested resource does not exist.");
}
function no_such_album () {
return make_error("no_such_album",
"The specified album does not exist");
}


app.listen(8081);
