var express = require('express');
var bodyParser = require('body-parser');
var _ = require('underscore');
var db = require('./db.js');
var bcrypt = require('bcryptjs');
var middleware = require('./middleware.js')(db);

var app = express();
var PORT = process.env.PORT || 3000;
var todos = [];

app.use(bodyParser.json());

app.get('/', function(request, response) {
	response.send('Omnimatics Todo API');
});

// GET /todos?completed=true
app.get('/todos', middleware.requireAuthentication, function(request, response) {
	console.log("User id: " + request.user.get('id'));
	var query = request.query;
	var where = {
		userId: request.user.get('id')
	}; //request.user.get('id')

	if(query.hasOwnProperty('completed') && query.completed === 'true') {
		where.completed = true;
	} else if(query.hasOwnProperty('completed') && query.completed === 'false') {
		where.completed = false
	}

	if(query.hasOwnProperty('q') && query.q.length > 0) {
		where.description = {
			$like: '%' + query.q + '%'
		};
	}

	db.todo.findAll({where: where}).then(function(todos) {
		response.json(todos);
	}, function(e) {
		response.status(500).send();
	});
});

// GET /todos/:id
app.get('/todos/:id', middleware.requireAuthentication, function(request, response) {
	var todoId = parseInt(request.params.id, 10);

	db.todo.findOne({
		where: {
			id: todoId,
			userId: request.user.get('id')
		}
	}).then(function(todo) {
		if(!!todo) {
			response.json(todo.toJSON())
		} else {
			response.status(404).send();
		}
	}, function(e) {
		response.status(500).send();
	});

});

// POST /todos/:id
app.post('/todos', middleware.requireAuthentication, function(request, response) {

	var body = _.pick(request.body, 'summary', 'description', 'completed');

	db.todo.create(body).then(function(todo) {
		request.user.addTodo(todo).then(function() {
			return todo.reload();
		}).then(function(todo) {
			response.json(todo.toJSON());
		});
	}, function(e) {
		response.status(400).json(e);
	});
	
});

// DELETE /todos/:id

app.delete('/todos/:id', middleware.requireAuthentication, function(request, response) {
	var todoId = parseInt(request.params.id, 10);

	db.todo.destroy({
		where: {
			id: todoId,
			userId: request.user.get('id')
		}
	}).then(function(rowsDeleted) {
		if(rowsDeleted === 0) {
			response.status(404).json({
				error: 'No todo with id'
			});
		} else {
			response.status(204).send();
		}
	}, function() {
		response.status(500).send();
	});

});

app.delete('/todos/multiple/:ids', middleware.requireAuthentication, function(request, response) {
	var requestIds = request.params.ids;

	var arr = requestIds.split(',');
	var parsedIds = [];
	arr.forEach(function(id) {
		parsedIds.push(parseInt(id, 10));
	});

	db.todo.destroy({
		where: {
			id: parsedIds,
			userId: request.user.get('id')
		}
	}).then(function(rowsDeleted) {
		if(rowsDeleted === 0) {
			response.status(404).json({
				error: 'No todo with id'
			});
		} else {
			response.status(204).send();
		}
	}, function() {
		response.status(500).send();
	});

});

app.put('/todos/:id', middleware.requireAuthentication, function(request, response) {
	var todoId = parseInt(request.params.id, 10);

	var body = _.pick(request.body, 'summary', 'description', 'completed');
	var attributes = {};

	console.log('todoId -> ' + todoId);
	console.log(JSON.stringify(body));

	if(body.hasOwnProperty('summary')) {
		attributes.summary = body.summary;
	}

	if(body.hasOwnProperty('completed')) {
		attributes.completed = body.completed;
	}

	if(body.hasOwnProperty('description')) {
		attributes.description = body.description;
	} 

	db.todo.findOne({
		where: {
			id: todoId,
			userId: request.user.get('id')
		}
	}).then(function(todo) {
		if(todo) {
			todo.update(attributes).then(function(todo) {
				response.json(todo.toJSON());
	}, function(e) {
		response.status(400).json(e);
	});
		} else {
			response.status(404).send();
		}
	}, function() {
		response.status(500).send();
	});
});

app.post('/users', function (request, response) {
	var body = _.pick(request.body, 'email', 'password');

	db.user.create(body).then(function (user) {
		response.json(user.toPublicJSON());
	}, function (e) {
		response.status(400).json(e);
		console.log(e);
	});
});

// POST /users/login

app.post('/users/login', function(request, response) {
	console.log(JSON.stringify(request.body));
	var body = _.pick(request.body, 'email', 'password');
	var userInstance;

	db.user.authenticate(body).then(function(user) {
		var token = user.generateToken('authentication');
		userInstance = user;

		return db.token.create({
			token: token
		});

	}).then(function(tokenInstance) {
		response.header('Auth', tokenInstance.get('token')).json(userInstance.toPublicJSON());
	}).catch(function() {
		response.status(401).send();
	});
});

app.get('/users/login', function(request, response) {
	var requestHeader = request.get('Auth');

	db.token.findOne({
		tokenHash: cryptojs.MD5(requestHeader).toString()
	}).then(function(tokenValue) {
		if(!tokenValue) {
			response.header('Access', 'false');
			response.status(403).send();
		} else {
			response.header('Access', 'true');
			response.status(204).send();
		}
	})
});

app.delete('/users/login', middleware.requireAuthentication, function(request, response) {
	request.token.destroy().then(function() {
		response.status(204).send();
	}).catch(function() {
		response.status(500).send();
	});
});

// app.use(express.static(__dirname + '/public'));

db.sequelize.sync({
	// force: true
}).then(function() {
	app.listen(PORT, function() {
		console.log('Express listening on port ' + PORT + '!');
	});
});



