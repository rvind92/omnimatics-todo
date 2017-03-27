module.exports = function(sequelize, DataTypes) {
	return sequelize.define('todo', {
		summary: {
			type: DataTypes.STRING,
			allowNull: false,
			validate: {
				len: [1, 50]
			}
		},
		description: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: "<No description provided>",
			validate: {
				len: [1, 500]
			}
		},
		completed: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		}
	});
};