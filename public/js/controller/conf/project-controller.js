'use strict';

define(['angular'], function(angular) {

    var app = angular.module('bugattiApp.controller.conf.projectModule', []);

    app.controller('ProjectCtrl', ['$scope', '$state', '$stateParams', '$modal', 'ProjectService', 'VersionService', 'EnvService',
        function($scope, $state, $stateParams, $modal, ProjectService, VersionService, EnvService) {
        $scope.currentPage = 1;
        $scope.pageSize = 20;
        $scope.my = false;
        if($state.current.name === 'conf.project.my') {
            $scope.my = true;
        }

        // load env
        EnvService.getAll(function(data) {
            if (data == null || data.length == 0) {
                return;
            }
            $scope.envId = data[0].id;
        });

        $scope.searchForm = function(projectName) {

            // count
            ProjectService.count(projectName, $scope.my, function(data) {
                $scope.totalItems = data;
            });

            // list
            ProjectService.getPage(projectName, $scope.my, 0, $scope.pageSize, function(data) {
                $scope.projects = data;
            });
        }

        $scope.searchForm($scope.s_projectName);

        // page
        $scope.setPage = function (pageNo) {
            ProjectService.getPage($scope.my, pageNo - 1, $scope.pageSize, function(data) {
                $scope.projects = data;
            });
        };

        $scope.vs_all = function(pid) {
            $scope.versions = [];
            VersionService.top(pid, function(data) {
                $scope.versions = data;
            })
        };


        // remove
        $scope.delete = function(id, index) {
            var modalInstance = $modal.open({
                templateUrl: 'partials/modal.html',
                controller: function ($scope, $modalInstance) {
                    $scope.ok = function () {
                        ProjectService.remove(id, function(state) {
                            $modalInstance.close(state);
                        });
                    };
                    $scope.cancel = function () {
                        $modalInstance.dismiss('cancel');
                    };
                }
            });
            modalInstance.result.then(function(data) {
                if (data.r >= 0) {
                    $scope.projects.splice(index, 1);
                    ProjectService.count($scope.my, function(num) {
                        $scope.totalItems = num;
                    });
                } else if (data.r == 'exist') {
                    alert('还有版本存在该项目，请删除后再操作。。。')
                } else if (data.r == 'none') {
                    alert('不存在的项目？')
                }
            });
        };
    }]);

    app.controller('ProjectShowCtrl', ['$scope', '$stateParams', '$modal', 'ProjectService', 'EnvService',
        function($scope, $stateParams, $modal, ProjectService, EnvService) {
            ProjectService.get($stateParams.id, function(data) {
                $scope.project = data;
            });

            ProjectService.atts($stateParams.id, function(data) {
                $scope.atts = data;
            });

            // load env all
            EnvService.getAll(function(data) {
                if (data == null || data.length == 0) {
                    return;
                }
                $scope.envs = data;
                $scope.envChange(data[0]);
            });

            // select env
            $scope.envChange = function(e) {
                $scope.env = e;
            };

            // load init variable
            ProjectService.vars($stateParams.id, function(data) {
                $scope.vars = data;
            });

            // ---------------------------------------------
            // 项目成员管理
            // ---------------------------------------------
            ProjectService.members($stateParams.id, function(data) {
                $scope.members = data;
            });

            $scope.addMember = function(jobNo) {
                $scope.jobNo$error = '';
                if (!/^of[0-9]{1,10}$/i.test(jobNo)) {
                    $scope.jobNo$error = '工号格式错误';
                    return;
                }
                var exist = false;
                angular.forEach($scope.members, function(m) {
                    if (m.jobNo === jobNo) {
                        exist = true;
                    }
                });
                if (exist) {
                    $scope.jobNo$error = '已存在';
                    return;
                }

                ProjectService.saveMember($stateParams.id, jobNo, function(data) {
                    if (data.r === 'none') {
                        $scope.jobNo$error = '不存在的用户，请在用户管理添加';
                    } else if (data.r > 0) {
                        ProjectService.members($stateParams.id, function(data) {
                            $scope.members = data;
                            $scope.jobNo$error = '';
                        });
                    } else {
                        $scope.jobNo$error = '添加错误';
                    }
                });
            }

            $scope.memberUp = function(mid, msg) {
                if (confirm(msg)) {
                    ProjectService.updateMember(mid, "up", function(data) {
                        if (data.r > 0) {
                            ProjectService.members($stateParams.id, function(data) {
                                $scope.members = data;
                            });
                        }
                    });
                }
            };
            $scope.memberDown = function(mid, msg) {
                if (confirm(msg)) {
                    ProjectService.updateMember(mid, "down", function(data) {
                        if (data.r > 0) {
                            ProjectService.members($stateParams.id, function(data) {
                                $scope.members = data;
                            });
                        }
                    });
                }
            };
            $scope.memberRemove = function(mid, msg) {
                if (confirm(msg)) {
                    ProjectService.updateMember(mid, "remove", function(data) {
                        if (data.r > 0) {
                            ProjectService.members($stateParams.id, function(data) {
                                $scope.members = data;
                            });
                        }
                    });
                }
            };
    }]);

    app.controller('ProjectCreateCtrl', ['$scope', '$stateParams', '$state', 'ProjectService', 'TemplateService', 'EnvService',
        function($scope, $stateParams, $state, ProjectService, TemplateService, EnvService) {

            $scope.saveOrUpdate = function(project) {

                project.items = [];
                project.variables = angular.copy($scope.vars);
                angular.forEach($scope.items, function(item) {
                    project.items.push({name: item.itemName, value: item.value})
                });

                ProjectService.save(angular.toJson(project), function(data) {
                    if (data.r >= 0) {
                        $state.go("conf.project.my");
                    } else if (data.r == 'exist') {
                        $scope.form.name.$invalid = true;
                        $scope.form.name.$error.exists = true;
                    }
                });
            };

            // load template all
            TemplateService.all(function(data) {
                $scope.templates = data;
            });

            // template change
            $scope.templateChange = function(tid) {
                $scope.items = [];
                if (angular.isUndefined(tid)) {
                    return;
                }
                if (angular.isUndefined($scope.env)) {
                    return;
                }
                var currScriptVersion = $scope.env.scriptVersion
                TemplateService.itemAttrs(tid, currScriptVersion, function(data) {
                    $scope.items = data;
                    // default init <input> ng-model value
                    angular.forEach($scope.items, function(item) {
                        if (item.default) {
                            item.value = item.default;
                        }
                    })
                });
                TemplateService.itemVars(tid, currScriptVersion, function(data) {
                    var _vars = angular.copy($scope.vars);
                    angular.forEach(_vars, function(v, index) {
                        if (v.name.indexOf('t.') === 0) {
                            delete _vars[index]; // delete object is null
                        }
                    });
                    _vars = _vars.filter(function(e){return e}); // clear null
                    angular.forEach(data, function(d) {
                        _vars.unshift({name: d.itemName, value: '', envId: $scope.env.id});  // first add
                    });
                    $scope.vars = _vars;
                });
            };

            // load env all
            EnvService.getAll(function(data) {
                if (data == null || data.length == 0) {
                    return;
                }
                $scope.envs = data;
                $scope.envChange(data[0]);
            });

            // select env
            $scope.envChange = function(e, tid) {
                $scope.env = e;
                $scope.templateChange(tid);
            };

            // project variable
            $scope.vars = [];
            $scope.addVar = function(v) {
                v.envId = $scope.env.id;   // bind env
                if (findInVars($scope.vars, v) != -1) {
                    $scope.varForm.varName.$invalid = true;
                    $scope.varForm.varName.$error.unique = true;
                    return;
                };
                $scope.vars.push(angular.copy(v));
                v.name = "", v.value = ""; // clear input value
                $scope.varForm.varName.$error.unique = false;
            };

            function findInVars(vars, v) {
                var find = -1;
                angular.forEach(vars, function(_v, index) {
                    if (_v.name == v.name && _v.envId == v.envId) {
                        find = index;
                        return;
                    }
                });
                return find;
            };

            $scope.editVar = function(repeat$scope) {
                repeat$scope.mode = 'edit';
            };

            $scope.deleteVar = function(v) {
                var index = findInVars($scope.vars, v)
                if (index != -1) {
                    $scope.vars.splice(index, 1);
                }
            };

        }]);

    app.controller('ProjectUpdateCtrl', ['$scope', '$stateParams', '$filter', '$state', 'ProjectService', 'TemplateService', 'EnvService',
        function($scope, $stateParams, $filter, $state, ProjectService, TemplateService, EnvService) {

            // update
            $scope.saveOrUpdate = function(project) {
                project.items = [];
                project.variables = angular.copy($scope.vars);
                angular.forEach($scope.items, function(item) {
                    project.items.push({name: item.itemName, value: item.value})
                });

                project.lastUpdated = $filter('date')(project.lastUpdated, "yyyy-MM-dd HH:mm:ss")
                ProjectService.update($stateParams.id, angular.toJson(project), function(data) {
                    if (data !== '0') {
                        $state.go("conf.project.my");
                    }
                });

            };

            ProjectService.get($stateParams.id, function(data) {
                // update form reset
                $scope.master = data;
                $scope.reset = function() {
                    $scope.project = angular.copy($scope.master);
                };
                $scope.isUnchanged = function(project) {
                    return angular.equals(project, $scope.master);
                };
                $scope.reset();

                $scope.templateChange(data.templateId)

            });

            // load init variable
            ProjectService.vars($stateParams.id, function(data) {
                $scope.vars = data;
            });

            // load template all
            TemplateService.all(function(data) {
                $scope.templates = data;
            });

            // template change
            $scope.templateChange = function(tid) {
                $scope.items = [];
                if (angular.isUndefined(tid)) {
                    return;
                }
                if (angular.isUndefined($scope.env)) {
                    return;
                }
                var currScriptVersion = $scope.env.scriptVersion
                TemplateService.itemAttrs(tid, currScriptVersion, function(data) {
                    $scope.items = data;
                    // attrs
                    ProjectService.atts($stateParams.id, function(attdata) {
                        angular.forEach($scope.items, function(item) {
                            angular.forEach(attdata, function(att) {
                                if (att.name == item.itemName) {
                                    item.value = att.value;
                                    return;
                                }
                            });
                        });
                    });
                });

                TemplateService.itemVars(tid, currScriptVersion, function(data) {
                    var _vars = angular.copy($scope.vars);
                    angular.forEach(_vars, function(v, index) {
                        if (v.name.indexOf('t.') === 0) {
                            delete _vars[index]; // delete object is null
                        }
                    });
                    _vars = _vars.filter(function(e){return e}); // clear null
                    angular.forEach(data, function(d) {
                        _vars.unshift({name: d.itemName, value: '', envId: $scope.env.id});  // first add
                    });
                    $scope.vars = _vars;
                });
            };

            // load env all
            EnvService.getAll(function(data) {
                if (data == null || data.length == 0) {
                    return;
                }
                $scope.envs = data;
                $scope.envChange(data[0]);
            });

            // select env
            $scope.envChange = function(e, tid) {
                $scope.env = e;
                $scope.templateChange(tid);
            };

            // project variable
            $scope.vars = [];
            $scope.addVar = function(v) {
                v.envId = $scope.env.id; // bind env
                if (findInVars($scope.vars, v) != -1) {
                    $scope.varForm.varName.$invalid = true;
                    $scope.varForm.varName.$error.unique = true;
                    return;
                };
                $scope.vars.push(angular.copy(v));
                v.name = "", v.value = ""; // clear input value
                $scope.varForm.varName.$error.unique = false;
            };

            function findInVars(vars, v) {
                var find = -1;
                angular.forEach(vars, function(_v, index) {
                    if (_v.name == v.name && _v.envId == v.envId) {
                        find = index;
                        return;
                    }
                });
                return find;
            };

            $scope.editVar = function(repeat$scope) {
                repeat$scope.mode = 'edit';
            };

            $scope.deleteVar = function(v) {
                var index = findInVars($scope.vars, v)
                if (index != -1) {
                    $scope.vars.splice(index, 1);
                }
            };

        }]);


    // ===================================================================
    // ------------------------------项目版本-----------------------------—
    // ===================================================================
    app.controller('VersionCtrl', ['$scope', '$stateParams', '$modal', 'VersionService',
        function($scope, $stateParams, $modal, VersionService) {

            $scope.currentPage = 1;
            $scope.pageSize = 10;

            // count
            VersionService.count($stateParams.id, function(data) {
                $scope.totalItems = data;
            });

            // list
            VersionService.getPage($stateParams.id, 0, $scope.pageSize, function(data) {
                $scope.versions = data;
            });

            // page
            $scope.setPage = function (pageNo) {
                VersionService.getPage($stateParams.id, pageNo - 1, $scope.pageSize, function(data) {
                    $scope.versions = data;
                });
            };

            // remove
            $scope.delete = function(id, index) {
                var modalInstance = $modal.open({
                    templateUrl: 'partials/modal.html',
                    controller: function ($scope, $modalInstance) {
                        $scope.ok = function () {
                            VersionService.remove(id, function(state) {
                                $modalInstance.close(state);
                            });
                        };
                        $scope.cancel = function () {
                            $modalInstance.dismiss('cancel');
                        };
                    }
                });
                modalInstance.result.then(function(data) {
                    if (data.r >= 0) {
                        $scope.versions.splice(index, 1);
                        VersionService.count($stateParams.id, function(num) {
                            $scope.totalItems = num;
                        });
                    } else if (data.r == 'exist') {
                        alert('还有配置在使用该版本，请删除后再操作。。。')
                    } else if (data.r == 'none') {
                        alert('不存在的版本？')
                    }
                });
            };
    }]);


    app.controller('VersionCreateCtrl', ['$scope', '$filter', '$stateParams', '$state', 'VersionService',
        function($scope, $filter, $stateParams, $state, VersionService) {
            $scope.version = {projectId: $stateParams.id, vs: ''}

            $scope.saveOrUpdate = function(version) {
                version.updated = $filter('date')(new Date(), "yyyy-MM-dd HH:mm:ss")
                VersionService.save(angular.toJson(version), function(data) {
                    if (data.r >= 0) {
                        $state.go('^');
                    } else if (data.r == 'exist') {
                        $scope.form.vs.$invalid = true;
                        $scope.form.vs.$error.exists = true;
                    }
                });
            };

            VersionService.getNexusVersions($stateParams.id, function(data) {
                $scope.versions = data;
            });

    }]);


    app.controller('VersionUpdateCtrl', ['$scope', '$stateParams', '$filter', '$state', 'VersionService',
        function($scope, $stateParams, $filter, $state, VersionService) {
            $scope.saveOrUpdate = function(version) {
                version.updated = $filter('date')(new Date(), "yyyy-MM-dd HH:mm:ss")

                VersionService.update($stateParams.vid, angular.toJson(version), function(data) {
                    if (data.r >= 0) {
                        $state.go('^');
                    } else if (data.r == 'exist') {
                        $scope.form.vs.$invalid = true;
                        $scope.form.vs.$error.exists = true;
                    }
                });
            };

            VersionService.get($stateParams.vid, function(data) {
                // update form reset
                $scope.master = data;
                $scope.reset = function() {
                    $scope.version = angular.copy($scope.master);
                };
                $scope.isUnchanged = function(version) {
                    return angular.equals(version, $scope.master);
                };
                $scope.reset();
            });

            VersionService.getNexusVersions($stateParams.id, function(data) {
                $scope.versions = data;
            });
    }]);

    app.controller('DependencyCtrl', ['$scope', '$stateParams', '$filter', '$state', 'DependencyService', 'ProjectService',
        function($scope, $stateParams, $filter, $state, DependencyService, ProjectService){
            $scope.showDependencies = function(){
                DependencyService.get($stateParams.id, function(data){
                    console.log(data)
                    $scope.groups = data
                })
            }
            $scope.showDependencies()

            ProjectService.getExceptSelf($stateParams.id, function(data){
                $scope.projects = data
            })

            $scope.removeDependency = function(parent,child){
                DependencyService.removeDependency(parent.id, child.id, function(data){
                    console.log(data)
                    $scope.showDependencies()
                })
            }

            $scope.addDependency = function(parent,child){
                DependencyService.addDependency(parent, child, function(data){
                    console.log(data)
                    $scope.showDependencies()
                })
            }
        }
    ])

});
